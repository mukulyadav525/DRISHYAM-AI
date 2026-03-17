import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { API_BASE } from '@/config/api';
import { useAuth } from '@/context/AuthContext';

export interface ActionMetadata {
    [key: string]: any;
}

export const useActions = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const performAction = async (actionType: string, targetId?: string, metadata?: ActionMetadata) => {
        const token = user?.token;
        if (!token) {
            toast.error("Session expired or invalid. Please login again.");
            return null;
        }
        setIsLoading(true);
        try {
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
            const token = user?.token;
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

            // Simulate actual download delay
            toast.loading(`Preparing ${data.filename}...`, { id: 'dl-toast' });

            setTimeout(() => {
                toast.success(`Downloaded ${data.filename}`, { id: 'dl-toast' });
                const downloadUrl = data.download_url.startsWith('http') || data.download_url.startsWith('data:')
                    ? data.download_url
                    : `${API_BASE.replace('/api/v1', '')}${data.download_url}`;
                window.open(downloadUrl, '_blank');
                console.log(`Simulated download: ${downloadUrl}`);
            }, 1500);

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
