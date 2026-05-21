import { Control, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { X } from "lucide-react";

interface QuestionItemProps {
  index: number;
  control: Control<any>;
  remove: (index: number) => void;
  isRemoveDisabled: boolean;
}

const QuestionItem = ({
  index,
  control,
  remove,
  isRemoveDisabled,
}: QuestionItemProps) => {
  // Watch the option values
  const options = useWatch({
    control,
    name: [
      `questions.${index}.a1`,
      `questions.${index}.a2`,
      `questions.${index}.a3`,
      `questions.${index}.a4`,
    ],
  });

  // Create options array for select items
  const optionItems = [
    { value: options[0] || "Option A", text: options[0] || "Option A" },
    { value: options[1] || "Option B", text: options[1] || "Option B" },
    { value: options[2] || "Option C", text: options[2] || "Option C" },
    { value: options[3] || "Option D", text: options[3] || "Option D" },
  ].filter((option) => option.value.trim() !== ""); // Filter out empty values

  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200 mb-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 text-blue-700 font-bold rounded-full w-8 h-8 flex items-center justify-center mr-3">
            {index + 1}
          </div>
          <h3 className="text-lg font-semibold text-gray-800">
            Question {index + 1}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-8 w-8 p-0 rounded-full hover:bg-red-100 hover:text-red-600"
          onClick={() => remove(index)}
          disabled={isRemoveDisabled}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove question</span>
        </Button>
      </div>

      <div className="space-y-4">
        {/* Question Title */}
        <FormField
          control={control}
          name={`questions.${index}.q_title`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question</FormLabel>
              <FormControl>
                <Input placeholder="Enter your question here..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option A */}
          <FormField
            control={control}
            name={`questions.${index}.a1`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Option A</FormLabel>
                <FormControl>
                  <Input placeholder="Option A" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Option B */}
          <FormField
            control={control}
            name={`questions.${index}.a2`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Option B</FormLabel>
                <FormControl>
                  <Input placeholder="Option B" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Option C */}
          <FormField
            control={control}
            name={`questions.${index}.a3`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Option C</FormLabel>
                <FormControl>
                  <Input placeholder="Option C" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Option D */}
          <FormField
            control={control}
            name={`questions.${index}.a4`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Option D</FormLabel>
                <FormControl>
                  <Input placeholder="Option D" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Correct Answer */}
        <FormField
          control={control}
          name={`questions.${index}.correct_a`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correct Answer</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select correct option" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {optionItems.map((option, idx) => (
                    <SelectItem value={option.value} key={idx}>
                      {option.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Explanation */}
        <FormField
          control={control}
          name={`questions.${index}.correct_a_reason`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Explanation</FormLabel>
              <FormControl>
                <Input
                  placeholder="Explain why this is the correct answer..."
                  {...field}
                  required
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

export default QuestionItem;
