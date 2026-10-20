import LearnClient from "./page-client";

export async function generateStaticParams() {
  try {
    const coursesRes = await fetch("https://api.pejuangyen.com/api/courses");
    const coursesData = await coursesRes.json();
    const params: { courseSlug: string; lessonSlug: string }[] = [{ courseSlug: "_", lessonSlug: "_" }];
    for (const course of (coursesData.data || [])) {
      const modRes = await fetch(`https://api.pejuangyen.com/api/courses/${course.id}/modules`);
      const modData = await modRes.json();
      for (const mod of (modData.data || [])) {
        for (const lesson of (mod.lessons || [])) {
          params.push({ courseSlug: course.slug, lessonSlug: lesson.slug });
        }
      }
    }
    return params;
  } catch {
    return [{ courseSlug: "_", lessonSlug: "_" }];
  }
}

export default function LearnPage() { return <LearnClient />; }
