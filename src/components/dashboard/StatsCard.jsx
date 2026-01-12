import React from 'react';
import { motion } from 'framer-motion';

export default function StatsCard({ icon: Icon, iconBg, value, label, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
      style={{ borderLeft: '4px solid #7CB342' }}
    >
      {/* Decorative gradient */}
      <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #7CB342 0%, #9CCC65 100%)' }}
      />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-4xl font-bold text-slate-800 tracking-tight">{value}</p>
          <p className="text-sm text-slate-500 mt-1">{label}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </motion.div>
  );
}