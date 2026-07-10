import { notFound } from 'next/navigation';
import { DetailView } from '@/components/event/DetailView';
import { CATEGORIES } from '@/lib/config';
import { getEvents } from '@/lib/events-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: '事件详情' };

interface PageProps {
  params: { id: string };
}

export default async function EventDetailPage({ params }: PageProps) {
  const allEvents = await getEvents();
  const idx = allEvents.findIndex((e) => e.id === params.id);
  const event = idx >= 0 ? allEvents[idx] : null;
  if (!event) notFound();

  const catLabel = CATEGORIES.find((c) => c.id === event.category)?.label ?? event.category;

  const prev = idx > 0 ? allEvents[idx - 1] : null;
  const next = idx < allEvents.length - 1 ? allEvents[idx + 1] : null;

  const related = allEvents
    .filter((e) => e.id !== event.id && (e.sourceId === event.sourceId || e.category === event.category))
    .slice(0, 4);

  return (
    <DetailView
      event={event}
      prev={prev}
      next={next}
      related={related}
      catLabel={catLabel}
    />
  );
}
