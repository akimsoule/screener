import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  readonly currentPage: number;
  readonly totalReportPages: number;
  readonly pageSizeForReports: number;
  readonly reportsTotal: number;
  readonly onPageChange: (p: number) => void;
  readonly loadingReports: boolean;
}

export function ReportsPagination({
  currentPage,
  totalReportPages,
  pageSizeForReports,
  reportsTotal,
  onPageChange,
  loadingReports,
}: Props) {
  if (totalReportPages <= 1) return null;

  return (
    <div className="px-4 pt-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          <span className="hidden sm:inline">
            Showing{" "}
            {reportsTotal > 0 ? (currentPage - 1) * pageSizeForReports + 1 : 0}{" "}
            to {Math.min(currentPage * pageSizeForReports, reportsTotal)} of{" "}
            {reportsTotal} reports
          </span>
          <span className="sm:hidden">
            {reportsTotal > 0 ? (currentPage - 1) * pageSizeForReports + 1 : 0}-
            {Math.min(currentPage * pageSizeForReports, reportsTotal)} /{" "}
            {reportsTotal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || loadingReports}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <span className="text-sm whitespace-nowrap">
            Page {currentPage} of {totalReportPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalReportPages || loadingReports}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
