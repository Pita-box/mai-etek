"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const taskSchema = z.object({
  title: z.string().min(2, {
    message: "Název musí mít alespoň 2 znaky.",
  }),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  points_reward: z.number().min(0),
  deadline: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  initialData?: Partial<TaskFormValues>;
  onSubmit: (data: FormData) => void;
}

export function TaskForm({ initialData, onSubmit }: TaskFormProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      priority: initialData?.priority || "medium",
      points_reward: initialData?.points_reward || 0,
      deadline: initialData?.deadline || "",
    },
  });

  const handleSubmit = (values: TaskFormValues) => {
    const formData = new FormData();
    formData.append("title", values.title);
    if (values.description) formData.append("description", values.description);
    formData.append("priority", values.priority);
    formData.append("points_reward", values.points_reward.toString());
    if (values.deadline) formData.append("deadline", values.deadline);
    onSubmit(formData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Název úkolu</FormLabel>
              <FormControl>
                <Input placeholder="Např. Uklidit kuchyň" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Popis</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Detailní instrukce..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorita</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte prioritu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Nízká</SelectItem>
                      <SelectItem value="medium">Střední</SelectItem>
                      <SelectItem value="high">Vysoká</SelectItem>
                      <SelectItem value="urgent">Kritická</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="points_reward"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Odměna (body)</FormLabel>
              <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : 0)} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Termín splnění</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormDescription>Nepovinné</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Uložit úkol</Button>
      </form>
    </Form>
  );
}
