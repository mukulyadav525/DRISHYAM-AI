"use client";

import { motion } from "framer-motion";
import { Activity, Radio } from "lucide-react";

interface LiveTickerProps {
    items: string[];
    isVisible: boolean;
}

export default function LiveTicker({ items, isVisible }: LiveTickerProps) {
    if (!isVisible || !items || items.length === 0) return null;

    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-4xl"
        >
            <div className="bg-indblue/90 backdrop-blur-md border border-saffron/30 rounded-full py-2 px-6 shadow-[0_0_30px_rgba(249,115,22,0.15)] flex items-center gap-4 overflow-hidden">
                <div className="flex items-center gap-2 flex-shrink-0 border-r border-white/10 pr-4">
                    <Radio className="text-saffron animate-pulse" size={16} />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Intel Ticker</span>
                </div>

                <div className="flex-1 overflow-hidden pointer-events-none relative h-6">
                    <motion.div
                        className="flex gap-12 whitespace-nowrap absolute"
                        animate={{ x: ["10%", "-100%"] }}
                        transition={{
                            duration: 30,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                    >
                        {/* Duplicate items for seamless loop */}
                        {[...items, ...items].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Activity className="text-indgreen" size={12} />
                                <span className="text-[10px] font-bold text-silver/90 font-mono tracking-tight">{item}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>

                <div className="flex-shrink-0 pl-4 border-l border-white/10">
                    <span className="text-[10px] font-bold text-indgreen uppercase tracking-tighter">Connected</span>
                </div>
            </div>
        </motion.div>
    );
}
