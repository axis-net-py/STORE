"use client";

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Printer } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

export function ReportFilters() {
  const t = useTranslations('reports.filters');
  const { language } = useLanguage();

  return (
    <Card className="border shadow-sm no-print">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range - Simple inputs */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="h-9 px-3 rounded-md border border-input bg-transparent text-xs"
              defaultValue={new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]}
            />
            <span className="text-muted-foreground text-xs">
              {language === 'pt' ? 'até' : 'hasta'}
            </span>
            <input
              type="date"
              className="h-9 px-3 rounded-md border border-input bg-transparent text-xs"
              defaultValue={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Report Type */}
          <Select defaultValue="sales">
            <SelectTrigger className="w-[180px] text-xs bg-card">
              <SelectValue placeholder={t('type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Vendas</SelectItem>
              <SelectItem value="purchases">Compras</SelectItem>
              <SelectItem value="inventory">Estoque</SelectItem>
            </SelectContent>
          </Select>

          {/* Action Buttons */}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="h-9 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </Button>
            <Button className="bg-[hsl(var(--primary))] text-primary-foreground hover:bg-[hsl(var(--primary))]/90 h-9 px-4 text-xs">
              {t('exportPDF')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

