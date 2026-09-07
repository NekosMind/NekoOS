import Desktop from '../desktop';

export const metadata = {
  title: 'Neko Archive — neko://lore',
  description: 'Open the Neko desktop directly to the lore archive.',
  alternates: {
    canonical: '/lore',
  },
};

export default function LorePage() {
  return <Desktop initialWindow="lore" />;
}
