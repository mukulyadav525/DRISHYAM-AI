"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, AlertTriangle, Eye, EyeOff, Lock, User } from "lucide-react";

export default function LoginPage() {
    const { login, isAuthenticated } = useAuth();
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Redirect if already logged in
    if (isAuthenticated) {
        router.replace("/");
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            await login(username, password);
            router.replace("/");
        } catch (err: any) {
            setError(err.message || "Authentication failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{
                background: "linear-gradient(135deg, #00216A 0%, #001142 40%, #0a0a2e 70%, #000814 100%)",
            }}
        >
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-saffron/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indblue/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-saffron/3 rounded-full blur-3xl" />

                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-5"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(255,107,34,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,107,34,0.3) 1px, transparent 1px)
                        `,
                        backgroundSize: "60px 60px",
                    }}
                />
            </div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-6 relative">
                        <div className="absolute inset-0 bg-saffron/20 rounded-2xl rotate-45 animate-pulse" />
                        <div className="absolute inset-1 bg-gradient-to-br from-saffron to-deeporange rounded-xl rotate-45 flex items-center justify-center">
                            <ShieldCheck className="text-white -rotate-45" size={36} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        <span className="text-saffron">SENTINEL</span> 1930
                    </h1>
                    <p className="text-sm text-white/40 mt-2 uppercase tracking-[0.25em] font-semibold">
                        Bharat Anti-Scam Intelligence Grid
                    </p>
                </div>

                {/* Glass Card */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-xl font-bold text-white mb-1">Secure Login</h2>
                    <p className="text-white/40 text-sm mb-8">Authenticate to access the Command Dashboard</p>

                    {error && (
                        <div className="mb-6 p-4 bg-redalert/10 border border-redalert/30 rounded-xl flex items-center gap-3">
                            <AlertTriangle size={18} className="text-redalert flex-shrink-0" />
                            <p className="text-sm text-redalert font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 outline-none focus:border-saffron/50 focus:bg-white/8 transition-all text-sm font-medium"
                                    placeholder="Enter your username"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 outline-none focus:border-saffron/50 focus:bg-white/8 transition-all text-sm font-medium"
                                    placeholder="Enter your password"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting || !username || !password}
                            className="w-full py-4 bg-gradient-to-r from-saffron to-deeporange text-white rounded-xl font-bold text-sm uppercase tracking-wider hover:shadow-lg hover:shadow-saffron/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Authenticating...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={18} />
                                    Authenticate
                                </>
                            )}
                        </button>
                    </form>

                    {/* Separator */}
                    <div className="my-6 border-t border-white/5" />

                    {/* Info */}
                    <div className="text-center">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mb-3">
                            Authorized Personnel Only
                        </p>
                        <div className="flex justify-center gap-4 text-[10px] text-white/15 font-mono">
                            <span>AES-256</span>
                            <span>·</span>
                            <span>JWT Auth</span>
                            <span>·</span>
                            <span>RBAC Protected</span>
                        </div>
                    </div>

                    {/* Evaluator Credentials */}
                    <div className="mt-6 pt-4 border-t border-white/5 text-center">
                        <div className="inline-block px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-[10px] text-white/40 font-mono">
                                <span className="text-saffron/60">ID:</span> admin <span className="mx-2 opacity-30">|</span> <span className="text-saffron/60">Pass:</span> password123
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-[10px] text-white/15 mt-6 font-medium">
                    Ministry of Home Affairs · Government of India · 🇮🇳
                </p>
            </div>
        </div>
    );
}
