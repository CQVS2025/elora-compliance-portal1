import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-slate-100">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-lg font-bold text-[#7CB342]">{payload[0].value} washes</p>
      </div>
    );
  }
  return null;
};

export default function WashTrendsChart({ data }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
    >
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-800">Wash Frequency Trends</h3>
        <div className="w-10 h-[3px] bg-[#7CB342] rounded-full mt-2" />
      </div>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="washGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7CB342" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#7CB342" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748B' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748B' }}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="washes"
              stroke="#7CB342"
              strokeWidth={3}
              fill="url(#washGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}