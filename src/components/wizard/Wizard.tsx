import { AnimatePresence, motion } from 'framer-motion';
import { useWizardStore, type WizardStep } from '@/store/wizardStore';
import { StepConfigure } from './StepConfigure';
import { StepDownload } from './StepDownload';
import { StepProcess } from './StepProcess';
import { StepUpload } from './StepUpload';
import { WizardHeader } from './WizardHeader';

const ORDER: WizardStep[] = ['upload', 'configure', 'process', 'download'];

function highestReached(current: WizardStep, hasFile: boolean, hasArchive: boolean): WizardStep {
  if (hasArchive) return 'download';
  if (current === 'process') return 'process';
  if (hasFile) return 'configure';
  return 'upload';
}

export function Wizard() {
  const step = useWizardStore((s) => s.step);
  const file = useWizardStore((s) => s.file);
  const archive = useWizardStore((s) => s.archive);
  const goToStep = useWizardStore((s) => s.goToStep);

  const reached = highestReached(step, file != null, archive != null);

  const handleStepClick = (target: WizardStep): void => {
    if (target === 'process') return;
    if (ORDER.indexOf(target) > ORDER.indexOf(reached)) return;
    goToStep(target);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <WizardHeader current={step} highestReached={reached} onStepClick={handleStepClick} />
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 shadow-sm backdrop-blur-md md:p-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex h-full flex-col"
          >
            {step === 'upload' && <StepUpload />}
            {step === 'configure' && <StepConfigure />}
            {step === 'process' && <StepProcess />}
            {step === 'download' && <StepDownload />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
