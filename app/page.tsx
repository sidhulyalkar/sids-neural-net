import {
  Hero,
  ProfessionalPillars,
  FeaturedCaseStudies,
  PublicationsHighlight,
  PersonalSignalStrip,
  CurrentlyBuilding,
  ContactCTA,
} from '@/components/home';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProfessionalPillars />
      <FeaturedCaseStudies />
      <PublicationsHighlight />
      <CurrentlyBuilding />
      <PersonalSignalStrip />
      <ContactCTA />
    </>
  );
}
