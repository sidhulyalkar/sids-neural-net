import { Camera, MapPin, Plus } from 'lucide-react';

const futureFrames = [
  {
    title: 'Coastal timing',
    location: 'California coast',
    tags: ['water', 'motion', 'light'],
  },
  {
    title: 'Trail memory',
    location: 'Backcountry routes',
    tags: ['landscape', 'texture', 'field'],
  },
  {
    title: 'Shasta field notes',
    location: 'Snow and ridgelines',
    tags: ['companion', 'weather', 'energy'],
  },
];

export function PhotographyMasonry() {
  return (
    <section id="photography" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <div>
            <p className="technical-label">Visual Field Notes</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-text-primary md:text-5xl">
              Photography as attention training.
            </h2>
            <p className="mt-5 text-text-secondary">
              This section is structured for real images from exported albums: landscapes, action,
              texture, travel, Shasta, and field moments. No stock filler, no fake gallery.
            </p>
            <div className="mt-6 node-shell p-4">
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <Camera className="h-5 w-5 text-cyan" />
                <span>Add real images with title, location, date, tags, camera, caption, and related memory node.</span>
              </div>
            </div>
          </div>

          <div className="grid auto-rows-[150px] grid-cols-1 gap-4 md:grid-cols-3">
            {futureFrames.map((frame, index) => (
              <div
                key={frame.title}
                className={`node-shell group flex flex-col justify-between p-4 ${index === 1 ? 'md:row-span-2' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="technical-label">Slot 0{index + 1}</span>
                  <Plus className="h-4 w-4 text-cyan/70 transition-transform group-hover:rotate-90" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{frame.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                    <MapPin className="h-3 w-3" />
                    {frame.location}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {frame.tags.map((tag) => (
                      <span key={tag} className="border border-white/10 px-2 py-0.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
