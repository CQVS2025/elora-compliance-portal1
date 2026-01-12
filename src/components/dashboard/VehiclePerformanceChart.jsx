import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { motion } from 'framer-motion';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-slate-100">
        <p className="text-sm font-medium text-slate-800">{payload[0].payload.name}</p>
        <p className="text-lg font-bold text-[#7CB342]">{payload[0].value} washes</p>
      </div>
    );
  }
  return null;
};

export default function VehiclePerformanceChart({ vehicles }) {
  const data = [...vehicles]
    .sort((a, b) => b.washes_completed - a.washes_completed)
    .slice(0, 10)
    .map(v => ({
      name: v.name,
      washes: v.washes_completed,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
    >
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-800">Vehicle Performance</h3>
        <div className="w-10 h-[3px] bg-[#7CB342] rounded-full mt-2" />
      </div>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            layout="vertical" 
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7CB342" />
                <stop offset="100%" stopColor="#9CCC65" />
              </linearGradient>
            </defs>
            <XAxis 
              type="number" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748B' }}
              domain={[0, 'dataMax + 1']}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#1E293B', fontWeight: 600 }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124, 179, 66, 0.08)' }} />
            <Bar 
              dataKey="washes" 
              fill="url(#barGradient)"
              radius={[0, 4, 4, 0]}
              barSize={24}
            >
              <LabelList 
                dataKey="washes" 
                position="right" 
                style={{ fontSize: 12, fontWeight: 600, fill: '#64748B' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}