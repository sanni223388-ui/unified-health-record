import React, { useState, useEffect } from 'react';
import { Sun, Sunset, Moon } from 'lucide-react';

interface GreetingProps {
  name?: string;
}

export const DynamicGreeting: React.FC<GreetingProps> = ({ name }) => {
  const [greeting, setGreeting] = useState('Welcome');
  const [Icon, setIcon] = useState(() => Sun);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('Good Morning');
      setIcon(() => Sun);
    } else if (hour >= 12 && hour < 17) {
      setGreeting('Good Afternoon');
      setIcon(() => Sun);
    } else if (hour >= 17 && hour < 21) {
      setGreeting('Good Evening');
      setIcon(() => Sunset);
    } else {
      setGreeting('Good Night');
      setIcon(() => Moon);
    }
  }, []);

  return (
    <div className="flex items-center gap-3 text-slate-100 mb-6">
      <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
        <Icon className="w-5 h-5 text-cyan-400" />
      </div>
      <div>
        <h1 className="text-2xl font-black tracking-tight">
          {greeting}{name ? `, ${name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Unified Health Record Portal
        </p>
      </div>
    </div>
  );
};
