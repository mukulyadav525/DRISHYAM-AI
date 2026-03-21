import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { API_BASE } from '@/config/api';

export interface ActionMetadata {
    [key: string]: any;
}

function resolveDownloadFilename(contentDisposition: string | null, fallback: string) {
    if (!contentDisposition) {
        return fallback;
    }

    const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
        return decodeURIComponent(utfMatch[1]);
    }

    const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (plainMatch?.[1]) {
        return plainMatch[1];
    }

    return fallback;
}

export const useActions = () => {
    const [isLoading, setIsLoading] = useState(false);

    const performAction = async (actionType: string, targetId?: string, metadata?: ActionMetadata) => {
        setIsLoading(true);
        try {
            const authStr = localStorage.getItem('drishyam_auth');
            const token = authStr ? JSON.parse(authStr).token : null;
            const res = await fetch(`${API_BASE}/actions/perform`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action_type: actionType,
                    target_id: targetId,
                    metadata: metadata
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Action failed');
            }

            const data = await res.json();
            toast.success(data.message || `${actionType} successful`);
            return data;
        } catch (error: any) {
            console.error(`Action ${actionType} failed:`, error);
            toast.error(error.message || `Failed to perform ${actionType}`);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const downloadSimulatedFile = async (category: string, fileType: string = 'pdf') => {
        setIsLoading(true);
        try {
            const authStr = localStorage.getItem('drishyam_auth');
            const token = authStr ? JSON.parse(authStr).token : null;
            if (!token) {
                throw new Error("Session expired or invalid. Please login again.");
            }

            const res = await fetch(`${API_BASE}/actions/download-sim?file_type=${fileType}&category=${category}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Download request failed');
            }

            const data = await res.json();
            toast.loading(`Preparing ${data.filename}...`, { id: 'dl-toast' });

            const downloadUrl = data.download_url.startsWith('http') || data.download_url.startsWith('data:')
                ? data.download_url
                : `${API_BASE.replace('/api/v1', '')}${data.download_url}`;

            const fileRes = await fetch(downloadUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!fileRes.ok) {
                const errData = await fileRes.json().catch(() => ({}));
                throw new Error(errData.detail || 'File download failed');
            }

            const blob = await fileRes.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const filename = resolveDownloadFilename(fileRes.headers.get('content-disposition'), data.filename);
            const anchor = document.createElement('a');
            anchor.href = blobUrl;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(blobUrl);
            toast.success(`Downloaded ${filename}`, { id: 'dl-toast' });

            return data;
        } catch (error: any) {
            console.error('Download failed:', error);
            toast.error(error.message || 'Failed to generate report');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        performAction,
        downloadSimulatedFile,
        isLoading
    };
};
