import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { TimelineEvent, TimelineEventSchema } from '@/lib/data/schemas';
import { z } from 'zod';

const TimelineFileSchema = z.object({
  events: z.array(TimelineEventSchema),
});

export function loadTimelineEvents(): TimelineEvent[] {
  const filePath = path.join(process.cwd(), 'data/manual/timeline-events.yaml');

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.parse(fileContent);
    const validated = TimelineFileSchema.parse(parsed);
    return validated.events;
  } catch (error) {
    console.error('Error loading timeline events:', error);
    return [];
  }
}
