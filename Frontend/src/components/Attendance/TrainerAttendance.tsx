import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  getCenterUserProfileByUserId,
  getTrainersProfile,
  submitTrainerAttendance,
} from "../../services/api"; // Import the API functions
import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import { UserData } from "../../types/admin";
// Define the structure of the attendance data for each trainer
interface AttendanceData {
  timeIn: string;
  timeOut: string;
  cu_id: number; // Course ID
  center_id: number; // Center ID
}

// Define the structure of the trainers data from the API
interface Trainer {
  t_id: number;
  user_name: string;
  center_name: string;
  course_full_name: string;
  t_course_id: number;
  t_center_id: number;
}
interface CenterUser {
  center_id: number;
}
const TrainerAttendance = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [attendance, setAttendance] = useState<{
    [key: number]: AttendanceData;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { selectedBatchId } = useBatch();
  const [userType, setUserType] = useState<string>("");
  const [userId, setUserId] = useState<number>(0);
  const [centerUserdata, setCenterUserdata] = useState<CenterUser[]>([]);
  const [centerUserCenterId, setCenterUserCenterId] = useState<number>(0);
  const { user_id } = useBatch();
  const getUserType = () => {
    try {
      const admin = localStorage.getItem(`admin${user_id}`);
      if (!admin) {
        console.log("No admin data found");
      }

      const parsedAdmin: UserData = JSON.parse(admin || "{}");
      if (parsedAdmin?.id) {
        setUserType(parsedAdmin.type);
        setUserId(parsedAdmin.id);
        setCenterUserCenterId(parsedAdmin.center_id);
      }
    } catch (error) {
      console.error("Error parsing admin data:", error);
    }
  };
  const fetchTrainers = async () => {
    setLoading(true);
    try {
      let response;
      if (userType === "Center Manager") {
        response = await getTrainersProfile(
          selectedBatchId,
          centerUserCenterId
        );
      } else {
        response = await getTrainersProfile(selectedBatchId);
      }

      const initialAttendance = response.data.reduce((acc: { [key: number]: AttendanceData }, trainer: Trainer) => {
        acc[trainer.t_id] = {
          timeIn: "",
          timeOut: "",
          cu_id: trainer.t_course_id,
          center_id: trainer.t_center_id,
        };
        return acc;
      }, {} as { [key: number]: AttendanceData });

      setAttendance(initialAttendance);
      setTrainers(response.data);
    } catch (error) {
      console.error("Error fetching trainers:", error);
      setError(error as Error);
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user_id > 0) {
      getUserType();
    }
  }, [userId]);

  useEffect(() => {
    if (userId > 0) {
      fetchTrainers();
    }
  }, [userId, centerUserCenterId]);

  const handleTimeChange = (
    trainerId: number,
    type: keyof AttendanceData,
    time: string
  ) => {
    setAttendance((prev) => ({
      ...prev,
      [trainerId]: {
        ...prev[trainerId],
        [type]: time,
      },
    }));
  };

  const handleSaveAttendance = async () => {
    const date = new Date().toISOString().split("T")[0];

    try {
      const attendancePromises = Object.entries(attendance).map(
        async ([trainerId, data]) => {
          if (!data.timeIn || !data.timeOut) return null;

          await submitTrainerAttendance({
            t_id: parseInt(trainerId),
            ta_date: new Date(date),
            checkin_time: data.timeIn,
            checkout_time: data.timeOut,
            cu_id: data.cu_id,
            center_id: data.center_id,
            tb_id: selectedBatchId,
          });
        }
      );

      await Promise.all(attendancePromises.filter(Boolean));
    } catch (error) {
      console.error("Error saving attendance:", error);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex justify-center items-center h-32">
            Loading trainer data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="text-red-500">
            Error loading trainer data: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trainers.length) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="text-gray-500">No trainers available.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-8xl mx-auto p-4 sm:p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Trainer Attendance"
        SettingDescription="Mark and manage attendance for trainers. Record check-in and check-out times for each trainer."
      />
      <CardHeader></CardHeader>
      <CardContent>
        <div className="text-gray-600 leading-relaxed mb-6 max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left">Trainer Name</th>
                <th className="p-4 text-left">Center Name</th>
                <th className="p-4 text-left">Course Name</th>
                <th className="p-4 text-left">Time In</th>
                <th className="p-4 text-left">Time Out</th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((trainer) => (
                <tr
                  key={trainer.t_id}
                  className="border-b transition-all duration-300 hover:scale-[1.02]"
                >
                  <td className="p-4">{trainer.user_name}</td>
                  <td className="p-4">{trainer.center_name}</td>
                  <td className="p-4">{trainer.course_full_name}</td>
                  <td className="p-4">
                    <input
                      type="time"
                      value={attendance[trainer.t_id]?.timeIn || ""}
                      onChange={(e) =>
                        handleTimeChange(trainer.t_id, "timeIn", e.target.value)
                      }
                      className="p-2 border rounded"
                    />
                  </td>
                  <td className="p-4">
                    <input
                      type="time"
                      value={attendance[trainer.t_id]?.timeOut || ""}
                      onChange={(e) =>
                        handleTimeChange(
                          trainer.t_id,
                          "timeOut",
                          e.target.value
                        )
                      }
                      className="p-2 border rounded"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSaveAttendance}
            className="transition-transform hover:scale-105 hover:shadow-md"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Attendance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrainerAttendance;
