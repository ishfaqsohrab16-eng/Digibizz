import QuizTrainerTable from "./QuizTrainerTable";

export default function QuizCreation({
  openForm,
}: {
  openForm: (formName: string) => void;
}) {
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <QuizTrainerTable openForm={openForm} />
    </div>
  );
}
