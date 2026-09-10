import { CenterVisit, VisitQuestion } from "../../services/api";
import { PrintDocument, PrintSection, PrintText, formatDate } from "../print/PrintDocument";

/**
 * A centre visit, on one A4 page - the Visit Report Proforma as it was filled.
 *
 * Every question with its yes or no AND its remark, because the remark is the
 * part somebody can act on. Up to six photographs from the visit: enough to
 * show somebody was there, few enough to stay on the page. Videos cannot be
 * printed, so the page says how many there are instead of silently leaving
 * them out.
 */

const mediaUrl = (file: string) =>
  `${import.meta.env.VITE_BACKEND_URL || ""}/uploads/center-visits/${file}`;

const MAX_PHOTOS = 6;

interface Props {
  visit: CenterVisit;
  questions: VisitQuestion[];
  filedBy?: string | null;
}

export default function VisitPrint({ visit, questions, filedBy }: Props) {
  const media = visit.cv_media || [];
  const images = media.filter((item) => item.type !== "video");
  const photos = images.slice(0, MAX_PHOTOS);
  const videos = media.length - images.length;
  const isOnlineCell = visit.cv_center_id === 0;

  return (
    <PrintDocument
      title="Centre Visit Report"
      subtitle={`Visit Report Proforma${isOnlineCell ? " · Online Cell" : ""}`}
      meta={[
        { label: "Centre", value: visit.cv_center_name },
        {
          label: "Week",
          value: `${formatDate(visit.cv_week_start)} – ${formatDate(visit.cv_week_end)}`,
        },
        {
          label: "Date of visit",
          value: visit.cv_visit_date
            ? `${formatDate(visit.cv_visit_date)}${visit.cv_visit_time ? `, ${visit.cv_visit_time}` : ""}`
            : null,
        },
        { label: "Master Trainer", value: filedBy },
      ]}
      status={{
        status: visit.cv_status,
        submittedOn: visit.cv_submitted_on,
        reviewedBy: visit.cv_reviewed_by_name,
        reviewedOn: visit.cv_reviewed_on,
        note: visit.cv_review_note,
      }}
      signatures={[
        { role: "Master Trainer", name: filedBy },
        { role: "M&E Officer" },
        { role: "Program Director" },
      ]}
    >
      <PrintSection title="Checklist">
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "5%" }} className="num">
                #
              </th>
              <th style={{ width: "45%" }}>Item</th>
              <th style={{ width: "10%" }} className="num">
                Answer
              </th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((question, index) => {
              const entry = visit.cv_answers?.[question.key];
              const answer = entry?.answer;
              return (
                <tr key={question.key}>
                  <td className="num">{index + 1}</td>
                  <td>{question.label}</td>
                  <td
                    className={`num ${
                      answer === "Yes" ? "print-yes" : answer === "No" ? "print-no" : "muted"
                    }`}
                  >
                    {answer || "—"}
                  </td>
                  <td>{entry?.note || <span className="print-empty">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </PrintSection>

      <PrintSection title="Overall remarks for this centre">
        <PrintText value={visit.cv_remarks} />
      </PrintSection>

      {media.length > 0 && (
        <PrintSection title="From the visit">
          {photos.length > 0 && (
            <div className="print-photos">
              {photos.map((item) => (
                <img key={item.file} src={mediaUrl(item.file)} alt="From the visit" />
              ))}
            </div>
          )}
          {(images.length > photos.length || videos > 0) && (
            <p className="print-note">
              {images.length > photos.length
                ? `${images.length - photos.length} more photograph${
                    images.length - photos.length === 1 ? "" : "s"
                  } on the LMS. `
                : ""}
              {videos > 0
                ? `${videos} video${videos === 1 ? "" : "s"} on the LMS, which cannot be printed.`
                : ""}
            </p>
          )}
        </PrintSection>
      )}
    </PrintDocument>
  );
}
