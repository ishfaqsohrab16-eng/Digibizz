import React, { useState, useEffect } from "react";
import HolidayForm, { HolidayFormProps } from "./HolidayForm";
import { getHolidays } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import DataTable from "../AdmissionPortal/DataTable";
import { Column } from "../../types/columns";
import { DEFAULT_HOLIDAYS_COLUMNS } from "../../utils/tableUtils";
import SettingsHeader from "../Settings/SettingsHeader";

interface getHolidaysData {
  h_date: string;
  h_reason: string;
  tb_slug: string;
}
const Holidays = () => {
  const [holidays, setHolidays] = useState<getHolidaysData[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const { selectedBatchId, selectedBatchName } = useBatch();
  const [columns, setColumns] = useState<Column[]>(DEFAULT_HOLIDAYS_COLUMNS);

  // Fetch holidays based on the selected batch
  const fetchHolidays = async () => {
    try {
      const response = await getHolidays(selectedBatchId);

      // Map API response to table format
      const formattedHolidays = response.map((holiday: any) => ({
        h_date: holiday.h_date,
        h_reason: holiday.h_reason,
        tb_id: holiday.tb_id,
        center_id: holiday.center_id,
        center_name: holiday.centers
          ? holiday.centers.center_name
          : "All Centers",
        tb_slug: holiday.training_batches?.tb_slug || "",
      }));
      setHolidays(formattedHolidays);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  // Fetch centers for name lookup
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        // Assuming getCenter is imported from services/api
        const response = await import("../../services/api").then((mod) =>
          mod.getCenter()
        );
        setCenters(response);
      } catch (error) {
        console.error("Error fetching centers:", error);
      }
    };
    fetchCenters();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchHolidays();
    }
  }, [selectedBatchId]);

  const handleNewHoliday = (newHoliday: HolidayFormProps) => {
    const formattedNewHoliday = {
      tb_id: selectedBatchId,
      h_date: newHoliday.h_date,
      h_reason: newHoliday.h_reason,
      center_id: newHoliday.center_id,
      center_name: newHoliday.center_id
        ? centers.find((c: any) => c.center_id === newHoliday.center_id)
            ?.center_name || "-"
        : "All Centers",
      tb_slug: newHoliday.training_batches?.tb_name || "",
    };
    setHolidays((prevHolidays) => [...prevHolidays, formattedNewHoliday]);
  };

  return (
    <div className="p-5 max-w-8xl mx-auto">
      <SettingsHeader
        SettingsHeader="Manage Holidays"
        SettingDescription="You can add only Public Holidays for current active batch. Trainers will not able to submit lecture report or attendance on these dates.
                    NOTE: Do not add Holidays of Saturday and Sunday dates."
      />
      <HolidayForm onHolidayAdded={handleNewHoliday} />
      <div className="text-gray-600 leading-relaxed mb-6">
        <DataTable
          data={holidays}
          columns={columns}
          setColumns={setColumns}
          isActionBtn={false}
          onView={(item) => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </div>
    </div>
  );
};

export default Holidays;
