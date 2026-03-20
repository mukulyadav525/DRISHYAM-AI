"use client";

import {
    Settings,
    User,
    Shield,
    Bell,
    Globe,
    Database,
    Lock,
    ChevronRight,
    Scale,
    FileCheck,
    FileText
} from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="space-y-8 max-w-4xl">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold text-indblue tracking-tight">System Settings</h2>
                <p className="text-silver mt-1">Manage grid parameters, security protocols, and node connectivity.</p>
            </div>

            <div className="space-y-6">
                {/* Account Section */}
                <div className="bg-white rounded-2xl border border-silver/10 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-boxbg flex items-center gap-3">
                        <User className="text-saffron" size={20} />
                        <h3 className="font-bold text-indblue font-sans">Operator Profile</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center py-2">
                            <div>
                                <p className="text-xs font-bold text-charcoal">Designation</p>
                                <p className="text-[11px] text-silver font-medium">National Intelligence Officer (Grade 1)</p>
                            </div>
                            <button className="text-[10px] font-bold text-indblue uppercase tracking-widest hover:text-saffron transition-colors">Edit</button>
                        </div>
                        <div className="flex justify-between items-center py-2 border-t border-boxbg">
                            <div>
                                <p className="text-xs font-bold text-charcoal">Node Access</p>
                                <p className="text-[11px] text-silver font-medium font-mono">DELHI-NCR-CENTRAL-01</p>
                            </div>
                            <ChevronRight className="text-silver" size={16} />
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-white rounded-2xl border border-silver/10 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-boxbg flex items-center gap-3">
                        <Shield className="text-saffron" size={20} />
                        <h3 className="font-bold text-indblue">Security & Privacy</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center py-2">
                            <div>
                                <p className="text-xs font-bold text-charcoal">2FA Biometric Authentication</p>
                                <p className="text-[11px] text-silver font-medium">Required for all scoring recalibrations.</p>
                            </div>
                            <div className="w-10 h-5 bg-indgreen rounded-full relative">
                                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-2 border-t border-boxbg">
                            <div>
                                <p className="text-xs font-bold text-charcoal">Data Sovereignty Mode</p>
                                <p className="text-[11px] text-silver font-medium">Zero-egress policy active for citizen metadata.</p>
                            </div>
                            <Lock className="text-indgreen" size={16} />
                        </div>
                    </div>
                </div>

                {/* System & API Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-silver/10 p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Database className="text-saffron" size={20} />
                                <h4 className="font-bold text-indblue text-sm">Database Sync</h4>
                            </div>
                            <p className="text-[11px] text-silver leading-relaxed">
                                Last snapshot taken 14 minutes ago. Cloud-Airgap bridge is operational.
                            </p>
                        </div>
                        <button className="w-full mt-6 py-2 bg-boxbg border border-silver/20 rounded-lg text-[10px] font-bold text-silver uppercase tracking-widest hover:bg-indblue hover:bg-opacity-5 transition-colors">
                            Run Diagnostic
                        </button>
                    </div>

                    <div className="bg-indblue p-6 rounded-2xl border border-saffron/20 text-white shadow-xl flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Globe className="text-saffron" size={20} />
                                <h4 className="font-bold text-sm">API Integrations</h4>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] uppercase font-bold text-silver">
                                    <span>NPCI Loop</span>
                                    <span className="text-indgreen">Active</span>
                                </div>
                                <div className="flex justify-between text-[10px] uppercase font-bold text-silver">
                                    <span>Telecom Probe</span>
                                    <span className="text-indgreen">Active</span>
                                </div>
                            </div>
                        </div>
                        <button className="w-full mt-6 py-2 bg-white/10 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest hover:bg-saffron transition-colors">
                            Manage Keys
                        </button>
                    </div>
                </div>
            </div>
            {/* Legal & Compliance Section (Phase 4) */}
            <div className="bg-white p-8 rounded-3xl border border-silver/10 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-redalert/10 rounded-2xl text-redalert">
                        <Scale size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-indblue">Legal & Compliance Foundations</h3>
                        <p className="text-xs text-silver mt-1">National standards for digital evidence and data privacy (IT Act & DPDP).</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Section 65B Evidence SOP */}
                    <div className="p-6 bg-boxbg rounded-2xl border border-silver/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-indblue text-sm flex items-center gap-2">
                                <FileCheck size={16} className="text-indgreen" />
                                Section 65B Certification
                            </h4>
                            <span className="text-[10px] font-bold text-indgreen bg-indgreen/10 px-2 py-0.5 rounded">ACTIVE</span>
                        </div>
                        <p className="text-[11px] text-charcoal leading-relaxed">
                            Every digital report generated by DRISHYAM AI includes a cryptographically signed Section 65B (Indian Evidence Act) certificate for court admissibility.
                        </p>
                        <div className="pt-4 border-t border-silver/5 flex flex-wrap gap-2">
                            {['Hash Validation', 'Timestamping', 'Forensic Bundle'].map((tag, i) => (
                                <span key={tag} className="text-[9px] font-bold text-silver bg-white border border-silver/10 px-2 py-1 rounded-md">{tag}</span>
                            ))}
                        </div>
                    </div>

                    {/* DPDP Privacy Framework */}
                    <div className="p-6 bg-boxbg rounded-2xl border border-silver/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-indblue text-sm flex items-center gap-2">
                                <Lock size={16} className="text-saffron" />
                                DPDP Act Compliance
                            </h4>
                            <span className="text-[10px] font-bold text-indblue bg-indblue/10 px-2 py-0.5 rounded">V2.1 READY</span>
                        </div>
                        <p className="text-[11px] text-charcoal leading-relaxed">
                            Purpose-limited data processing with explicit citizen consent. Right-to-erasure and grievance redressal integrated into BASIG core.
                        </p>
                        <ul className="text-[10px] font-bold text-indblue space-y-1">
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-saffron rounded-full" />
                                Data Minimization Active
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-saffron rounded-full" />
                                Consent Manager Integrated
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-8 flex flex-col md:flex-row gap-4">
                    <button className="flex-1 p-4 bg-indblue text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indblue/90">
                        <Scale size={18} />
                        View Full Indian Law Mapping
                    </button>
                    <button className="flex-1 p-4 bg-white border border-indblue text-indblue rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indblue/5">
                        <FileText size={18} />
                        Download Policy Framework PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
