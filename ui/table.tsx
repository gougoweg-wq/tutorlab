import * as React from "react";
import { cn } from "./cn";

export const TableWrap = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("overflow-x-auto scroll-thin rounded-lg border border-line bg-surface", className)} {...p} />;
export const Table = ({ className, ...p }: React.TableHTMLAttributes<HTMLTableElement>) => <table className={cn("w-full text-[15px] border-collapse", className)} {...p} />;
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn("text-left font-medium text-[12px] uppercase tracking-[0.06em] text-muted px-4 py-3 border-b border-line whitespace-nowrap", className)} {...p} />;
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-4 py-3.5 border-b border-line align-middle", className)} {...p} />;
export const Tr = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("transition-colors hover:bg-surface-2/60 [&:last-child>td]:border-b-0", className)} {...p} />;
