"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  UserCheck, 
  UserX, 
  Phone, 
  Clock, 
  Shield,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { API_BASE } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";

interface SimulationRequest {
  id: number;
  phone_number: string;
  status: string;
  requested_at: string;
}

export default function ManagementOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SimulationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRequests = async () => {
    if (!user?.token) return;
    setIsLoading(true);
    try {
      const token = user.token;
      
      const res = await fetch(`${API_BASE}/auth/simulation/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      } else {
        const errText = await res.text();
        console.error("Dashboard list error:", res.status, errText);
        toast.error(`HQ Error: ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Connection Failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user?.token) {
      fetchRequests();
    }
  }, [isOpen, user?.token]);

  const handleAction = async (id: number, approve: boolean) => {
    try {
      const token = user?.token;
      
      const res = await fetch(`${API_BASE}/auth/simulation/approve/${id}?approve=${approve}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success(approve ? "Access Approved" : "Access Rejected");
        fetchRequests();
      }
    } catch (e) {
      toast.error("Action failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-indblue/40 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-indblue p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-saffron" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Access Management</h2>
              <p className="text-[10px] font-bold text-silver uppercase tracking-widest">Simulation Clearance Control</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-8 max-h-[60vh] overflow-y-auto">
          {isLoading && requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-indblue mb-4" size={32} />
              <p className="text-xs font-bold text-silver uppercase tracking-widest">Syncing with HQ...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-bold text-silver italic">No pending simulation requests.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <div key={req.id} className="p-4 sm:p-5 rounded-2xl bg-boxbg border border-silver/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group hover:border-indblue/20 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-silver/5 flex items-center justify-center text-indblue">
                      <Phone size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-indblue">{req.phone_number}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={12} className="text-silver" />
                        <span className="text-[10px] font-medium text-silver">
                          {req.requested_at ? new Date(req.requested_at).toLocaleString() : 'N/A'}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ml-2 ${
                          req.status === 'pending' ? 'bg-saffron/10 text-saffron' :
                          req.status === 'approved' ? 'bg-indgreen/10 text-indgreen' :
                          'bg-redalert/10 text-redalert'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => handleAction(req.id, false)}
                        className="p-3 bg-white text-redalert rounded-xl border border-redalert/10 hover:bg-redalert hover:text-white transition-all shadow-sm"
                        title="Reject"
                      >
                        <UserX size={18} />
                      </button>
                      <button 
                        onClick={() => handleAction(req.id, true)}
                        className="p-3 bg-indgreen text-white rounded-xl hover:bg-indgreen/90 transition-all shadow-lg shadow-indgreen/20"
                        title="Approve"
                      >
                        <UserCheck size={18} />
                      </button>
                    </div>
                  )}

                  {req.status !== 'pending' && (
                    <div className="flex items-center gap-2 pr-2">
                        {req.status === 'approved' ? (
                             <CheckCircle2 className="text-indgreen" size={24} />
                        ) : (
                             <XCircle className="text-redalert" size={24} />
                        )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-boxbg border-t border-silver/5 flex justify-end">
          <p className="text-[9px] font-bold text-silver/40 uppercase tracking-[0.2em]">National Command Authorization Node</p>
        </div>
      </div>
    </div>
  );
}
