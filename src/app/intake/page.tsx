'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';

type ContactMethod = 'Email' | 'Phone' | 'WhatsApp';
type InterestedCountry = 'Australia' | 'New Zealand' | 'Both';
type MigrationGoal =
  | 'Permanent residency'
  | 'Employer sponsorship'
  | 'Study pathway'
  | 'Visitor visa'
  | 'Partner/family visa'
  | 'Not sure';
type MaritalStatus = 'Single' | 'Married' | 'De facto' | 'Separated' | 'Divorced' | 'Widowed';
type YesNo = 'Yes' | 'No';

interface IntakeFormData {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  residenceCountry: string;
  address: string;
  email: string;
  phone: string;
  contactMethod: ContactMethod;
  interestedCountry: InterestedCountry;
  mainGoal: MigrationGoal;
  timeframe: string;
  maritalStatus: MaritalStatus;
  dependants: string;
  migrateWithFamily: YesNo;
  partnerFullName: string;
  partnerNationality: string;
  highestQualification: string;
  fieldOfStudy: string;
  institution: string;
  studyCountry: string;
  completionYear: string;
  currentOccupation: string;
  migrationOccupation: string;
  workExperienceYears: string;
  currentEmployer: string;
  dutiesSummary: string;
  englishTestCompleted: YesNo;
  englishTestType: string;
  englishTestDate: string;
  englishScoreSummary: string;
  previousRefusal: YesNo;
  refusalDetails: string;
  previousCancellation: YesNo;
  overstayRemoval: YesNo;
  criminalHistory: YesNo;
  healthCondition: YesNo;
  characterDetails: string;
  healthDetails: string;
  passportBioPage: string;
  resume: string;
  qualificationsDoc: string;
  transcripts: string;
  englishResultDoc: string;
  refusalDocs: string;
}

const DRAFT_KEY = 'vpm-intake-draft-v1';

const initialData: IntakeFormData = {
  fullName: '',
  dateOfBirth: '',
  nationality: '',
  residenceCountry: '',
  address: '',
  email: '',
  phone: '',
  contactMethod: 'Email',
  interestedCountry: 'Australia',
  mainGoal: 'Not sure',
  timeframe: '',
  maritalStatus: 'Single',
  dependants: '',
  migrateWithFamily: 'No',
  partnerFullName: '',
  partnerNationality: '',
  highestQualification: '',
  fieldOfStudy: '',
  institution: '',
  studyCountry: '',
  completionYear: '',
  currentOccupation: '',
  migrationOccupation: '',
  workExperienceYears: '',
  currentEmployer: '',
  dutiesSummary: '',
  englishTestCompleted: 'No',
  englishTestType: '',
  englishTestDate: '',
  englishScoreSummary: '',
  previousRefusal: 'No',
  refusalDetails: '',
  previousCancellation: 'No',
  overstayRemoval: 'No',
  criminalHistory: 'No',
  healthCondition: 'No',
  characterDetails: '',
  healthDetails: '',
  passportBioPage: '',
  resume: '',
  qualificationsDoc: '',
  transcripts: '',
  englishResultDoc: '',
  refusalDocs: '',
};

const sectionNav = [
  { id: 'client-details', label: 'Client details' },
  { id: 'migration-goal', label: 'Migration goal' },
  { id: 'family', label: 'Family' },
  { id: 'education', label: 'Education' },
  { id: 'employment', label: 'Employment' },
  { id: 'english-language', label: 'English language' },
  { id: 'risk-screening', label: 'Risk screening' },
  { id: 'documents', label: 'Documents' },
] as const;

const requiredFields: Record<keyof Pick<IntakeFormData, 'fullName' | 'email' | 'dateOfBirth' | 'nationality' | 'residenceCountry' | 'phone' | 'mainGoal' | 'currentOccupation'>, string> = {
  fullName: 'Please enter your full name so we know what to call you.',
  email: 'Please share your email so we can contact you with next steps.',
  dateOfBirth: 'Please add your date of birth for eligibility checks.',
  nationality: 'Please add your nationality.',
  residenceCountry: 'Please add your current country of residence.',
  phone: 'Please add your phone number in case we need to reach you quickly.',
  mainGoal: 'Please choose the migration goal that best matches your plans.',
  currentOccupation: 'Please add your current occupation.',
};

const keyItems = Object.keys(requiredFields) as Array<keyof typeof requiredFields>;

export default function IntakePage() {
  const [formData, setFormData] = useState<IntakeFormData>(initialData);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof IntakeFormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof IntakeFormData, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [draftStatus, setDraftStatus] = useState('Autosaving draft locally…');

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(DRAFT_KEY);
    if (!savedDraft) return;

    try {
      const parsed = JSON.parse(savedDraft) as Partial<IntakeFormData>;
      setFormData((prev) => ({ ...prev, ...parsed }));
      setDraftStatus('Saved draft restored from this browser.');
    } catch {
      setDraftStatus('We could not restore a previous draft. You can continue with a new one.');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    setDraftStatus('Draft saved locally on this device.');
  }, [formData]);

  const riskFlags = useMemo(() => {
    const flags: string[] = [];

    if (formData.previousRefusal === 'Yes') flags.push('Previous visa refusal declared');
    if (formData.previousCancellation === 'Yes') flags.push('Previous visa cancellation declared');
    if (formData.overstayRemoval === 'Yes') flags.push('Overstay/deportation/removal history declared');
    if (formData.criminalHistory === 'Yes') flags.push('Criminal charge/conviction declared');
    if (formData.healthCondition === 'Yes') flags.push('Serious health condition declared');

    return flags;
  }, [formData]);

  const validate = (data: IntakeFormData) => {
    const errors: Partial<Record<keyof IntakeFormData, string>> = {};

    keyItems.forEach((field) => {
      if (!data[field]?.trim()) errors[field] = requiredFields[field];
    });

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Please enter a valid email address (for example, name@example.com).';
    }

    return errors;
  };

  const missingKeyItems = keyItems.filter((item) => !formData[item].trim());
  const completionCount = Object.values(formData).filter(Boolean).length;
  const completionPercent = Math.round((completionCount / Object.keys(formData).length) * 100);

  const readinessStatus =
    riskFlags.length > 0
      ? 'Needs consultant review'
      : missingKeyItems.length > 0
        ? 'In progress'
        : 'Appears ready for preliminary review';

  const onChange = (field: keyof IntakeFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (submitAttempted || touched[field]) {
      const nextData = { ...formData, [field]: value };
      setValidationErrors(validate(nextData));
    }
  };

  const onBlur = (field: keyof IntakeFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setValidationErrors(validate(formData));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    const errors = validate(formData);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
  };

  const clearSavedDraft = () => {
    window.localStorage.removeItem(DRAFT_KEY);
    setFormData(initialData);
    setValidationErrors({});
    setTouched({});
    setSubmitAttempted(false);
    setDraftStatus('Saved draft cleared. You can start again anytime.');
  };

  const shouldShowError = (field: keyof IntakeFormData) => Boolean(validationErrors[field] && (submitAttempted || touched[field]));

  return (
    <section className="intake-layout">
      <form className="intake-form" onSubmit={onSubmit} noValidate>
        <div className="hero">
          <h1>VPM Intake Questionnaire</h1>
          <p>Please complete all sections for a preliminary migration assessment.</p>
          <p className="draft-status">{draftStatus}</p>
          <button type="button" className="secondary-btn" onClick={clearSavedDraft}>Clear saved draft</button>
        </div>

        <nav className="section-nav card" aria-label="Questionnaire sections">
          {sectionNav.map((section) => (
            <a key={section.id} href={`#${section.id}`}>{section.label}</a>
          ))}
        </nav>

        <Fieldset id="client-details" title="Client details" helper="Your personal and contact details help us prepare your profile." >
          <Input required label="Full name" value={formData.fullName} error={shouldShowError('fullName') ? validationErrors.fullName : undefined} onBlur={() => onBlur('fullName')} onChange={(v) => onChange('fullName', v)} />
          <Input required label="Date of birth" type="date" value={formData.dateOfBirth} error={shouldShowError('dateOfBirth') ? validationErrors.dateOfBirth : undefined} onBlur={() => onBlur('dateOfBirth')} onChange={(v) => onChange('dateOfBirth', v)} />
          <Input required label="Nationality" value={formData.nationality} error={shouldShowError('nationality') ? validationErrors.nationality : undefined} onBlur={() => onBlur('nationality')} onChange={(v) => onChange('nationality', v)} />
          <Input required label="Country of residence" value={formData.residenceCountry} error={shouldShowError('residenceCountry') ? validationErrors.residenceCountry : undefined} onBlur={() => onBlur('residenceCountry')} onChange={(v) => onChange('residenceCountry', v)} />
          <Input label="Residential address" value={formData.address} onChange={(v) => onChange('address', v)} />
          <Input required label="Email" type="email" value={formData.email} error={shouldShowError('email') ? validationErrors.email : undefined} onBlur={() => onBlur('email')} onChange={(v) => onChange('email', v)} />
          <Input required label="Phone" value={formData.phone} error={shouldShowError('phone') ? validationErrors.phone : undefined} onBlur={() => onBlur('phone')} onChange={(v) => onChange('phone', v)} />
          <Select label="Preferred contact method" value={formData.contactMethod} options={['Email', 'Phone', 'WhatsApp']} onChange={(v) => onChange('contactMethod', v)} />
        </Fieldset>

        <Fieldset id="migration-goal" title="Migration goal" helper="Tell us where you want to go and what outcome you want.">
          <Select label="Interested country" value={formData.interestedCountry} options={['Australia', 'New Zealand', 'Both']} onChange={(v) => onChange('interestedCountry', v)} />
          <Select required label="Main goal" value={formData.mainGoal} options={['Permanent residency', 'Employer sponsorship', 'Study pathway', 'Visitor visa', 'Partner/family visa', 'Not sure']} error={shouldShowError('mainGoal') ? validationErrors.mainGoal : undefined} onBlur={() => onBlur('mainGoal')} onChange={(v) => onChange('mainGoal', v)} />
          <Input label="Desired timeframe" placeholder="e.g. within 12 months" value={formData.timeframe} onChange={(v) => onChange('timeframe', v)} />
        </Fieldset>

        <Fieldset id="family" title="Family" helper="Family details help us identify who may be included in your application.">{/* unchanged */}
          <Select label="Marital status" value={formData.maritalStatus} options={['Single', 'Married', 'De facto', 'Separated', 'Divorced', 'Widowed']} onChange={(v) => onChange('maritalStatus', v)} />
          <Input label="Number of dependants" type="number" value={formData.dependants} onChange={(v) => onChange('dependants', v)} />
          <Select label="Will partner/dependants migrate with you?" value={formData.migrateWithFamily} options={['Yes', 'No']} onChange={(v) => onChange('migrateWithFamily', v)} />
        </Fieldset>

        <Fieldset id="education" title="Education" helper="Your education history can affect pathway options.">
          <Input label="Highest qualification" value={formData.highestQualification} onChange={(v) => onChange('highestQualification', v)} />
          <Input label="Field of study" value={formData.fieldOfStudy} onChange={(v) => onChange('fieldOfStudy', v)} />
          <Input label="Institution" value={formData.institution} onChange={(v) => onChange('institution', v)} />
          <Input label="Country of study" value={formData.studyCountry} onChange={(v) => onChange('studyCountry', v)} />
          <Input label="Completion year" type="number" value={formData.completionYear} onChange={(v) => onChange('completionYear', v)} />
        </Fieldset>

        <Fieldset id="employment" title="Employment" helper="Work history supports occupation and skills assessment.">
          <Input required label="Current occupation" value={formData.currentOccupation} error={shouldShowError('currentOccupation') ? validationErrors.currentOccupation : undefined} onBlur={() => onBlur('currentOccupation')} onChange={(v) => onChange('currentOccupation', v)} />
          <Input label="Intended migration occupation" value={formData.migrationOccupation} onChange={(v) => onChange('migrationOccupation', v)} />
          <Input label="Total years of relevant work experience" type="number" value={formData.workExperienceYears} onChange={(v) => onChange('workExperienceYears', v)} />
          <Input label="Current employer" value={formData.currentEmployer} onChange={(v) => onChange('currentEmployer', v)} />
          <TextArea label="Brief duties summary" value={formData.dutiesSummary} onChange={(v) => onChange('dutiesSummary', v)} />
        </Fieldset>

        <Fieldset id="english-language" title="English language" helper="Include test information if available."><Select label="English test completed?" value={formData.englishTestCompleted} options={['Yes', 'No']} onChange={(v) => onChange('englishTestCompleted', v)} /></Fieldset>

        <Fieldset id="risk-screening" title="Risk screening" helper="These questions help us identify any complexity early."><Select label="Any previous visa refusal?" value={formData.previousRefusal} options={['Yes', 'No']} onChange={(v) => onChange('previousRefusal', v)} /></Fieldset>

        <Fieldset id="documents" title="Documents checklist" helper="List what you already have; uploads can be integrated later."><Input label="Passport bio page" value={formData.passportBioPage} onChange={(v) => onChange('passportBioPage', v)} placeholder="Attach later - placeholder" /></Fieldset>

        <p className="disclaimer">This questionnaire is for preliminary assessment only and does not confirm eligibility or guarantee any visa outcome.</p>
      </form>

      <aside className="intake-summary card"><h2>Review summary</h2><p><strong>Completion status:</strong> {completionPercent}%</p><p><strong>Estimated readiness:</strong> {readinessStatus}</p></aside>
    </section>
  );
}

function Fieldset({ id, title, helper, children }: { id: string; title: string; helper: string; children: ReactNode }) {
  return (
    <fieldset id={id} className="card intake-fieldset">
      <legend>{title}</legend>
      <p className="fieldset-helper">{helper}</p>
      <div className="input-grid">{children}</div>
    </fieldset>
  );
}

function Input({ label, onChange, error, required, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; error?: string; onChange: (value: string) => void }) {
  return (
    <label className={`field ${error ? 'field--error' : ''}`}>
      <span>{label} {required ? <em className="required-indicator" aria-label="required">*</em> : null}</span>
      <input {...props} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function Select({ label, options, onChange, error, required, ...props }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & { label: string; options: string[]; error?: string; onChange: (value: string) => void }) {
  return (
    <label className={`field ${error ? 'field--error' : ''}`}>
      <span>{label} {required ? <em className="required-indicator" aria-label="required">*</em> : null}</span>
      <select {...props} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function TextArea({ label, onChange, ...props }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return (
    <label className="field field--full">
      <span>{label}</span>
      <textarea rows={4} {...props} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
