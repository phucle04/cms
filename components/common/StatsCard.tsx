import React from 'react';
import { Card, CardContent } from './Card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function StatsCard({ title, value, change, icon, className }: StatsCardProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
            {change !== undefined && (
              <p
                className={cn(
                  'text-sm font-medium mt-2',
                  isPositive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {isPositive ? '+' : ''}{change}% from last period
              </p>
            )}
          </div>
          {icon && <div className="text-gray-400 dark:text-gray-600">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
