'use client';

import React, { useEffect, useState } from 'react';
import { 
    Clock, 
    Download, 
    FileText, 
    ShieldAlert, 
    ShieldCheck, 
    Search,
    Filter,
    ArrowUpRight
} from 'lucide-react';
import { API_BASE } from '@/config/api';

interface ForensicHistoryItem {
    id: number;
    filename: string;
    verdict: 'REAL' | 'SUSPICIOUS' | 'FAKE';
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: string;
    mime_type: string;
}

export default function HistoryPage() {
    const [history, setHistory] = useState<ForensicHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const authStr = localStorage.getItem('sentinel_auth');
                const token = authStr ? JSON.parse(authStr).token : null;
                
                const res = await fetch(`${API_BASE}/forensic/history`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (res.ok) {
                    setHistory(await res.json());
                }
            } catch (err) {
                console.error("Fetch History Error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const handleDownload = async (id: number) => {
        try {
            const authStr = localStorage.getItem('sentinel_auth');
            const token = authStr ? JSON.parse(authStr).token : null;
            
            const res = await fetch(`${API_BASE}/forensic/report/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Forensic_Report_${id}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        } catch (err) {
            console.error("Download Error:", err);
        }
    };

    const filteredHistory = history.filter(item => 
        item.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getVerdictStyle = (v: string) => {
        if (v === 'REAL') return 'bg-indgreen/10 text-indgreen';
        if (v === 'SUSPICIOUS') return 'bg-gold/10 text-gold';
        return 'bg-redalert/10 text-redalert';
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-indblue tracking-tight">Forensic History</h2>
                <p className="text-silver mt-1">Audit log of all media authenticity scans.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search files..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-silver/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-silver/10 rounded-xl text-xs font-bold text-silver hover:text-indblue transition-all">
                        <Filter size={14} />
                        Filter
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-silver/10 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-boxbg/30 border-b border-silver/10">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-silver uppercase tracking-wider">File Details</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-silver uppercase tracking-wider">Verdict</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-silver uppercase tracking-wider">Risk Level</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-silver uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-silver uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-silver/10">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-silver italic text-sm">
                                    Loading history...
                                </td>
                            </tr>
                        ) : filteredHistory.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-silver italic text-sm">
                                    No forensic scans found.
                                </td>
                            </tr>
                        ) : filteredHistory.map((item) => (
                            <tr key={item.id} className="hover:bg-boxbg/20 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-boxbg rounded-lg flex items-center justify-center text-indblue">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-indblue truncate max-w-[200px]">{item.filename}</p>
                                            <p className="text-[10px] text-silver font-medium">{item.mime_type}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getVerdictStyle(item.verdict)}`}>
                                        {item.verdict}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.risk === 'HIGH' ? 'bg-redalert' : item.risk === 'MEDIUM' ? 'bg-gold' : 'bg-indgreen'}`} />
                                        <span className="text-xs font-medium text-indblue">{item.risk}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-silver">
                                        <Clock size={12} />
                                        <span className="text-xs">{new Date(item.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleDownload(item.id)}
                                        className="p-2 text-silver hover:text-saffron transition-all hover:bg-saffron/5 rounded-lg opacity-0 group-hover:opacity-100"
                                        title="Download Forensic Report"
                                    >
                                        <Download size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
