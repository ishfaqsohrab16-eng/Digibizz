import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Column } from "../../types/columns";
import { Settings2 } from "lucide-react";

interface ColumnSelectorProps {
  columns: Column[];
  onColumnToggle: (columnId: string) => void;
}

export function ColumnSelector({
  columns,
  onColumnToggle,
}: ColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <Settings2 className="h-4 w-4" />
          <span className="ml-2">Columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[200px] bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg rounded-lg"
      >
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.visible}
            onCheckedChange={() => onColumnToggle(column.id)}
            className="hover:bg-[hsl(var(--teal-light))] text-[hsl(var(--foreground))]"
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
