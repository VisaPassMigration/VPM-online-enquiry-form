'use client';

import { FormEvent, useMemo, useState } from 'react';

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

const keyItems: Array<keyof IntakeFormData> = [
  'fullName',
  'dateOfBirth',
  'nationality',
  'email',
  'phone',
  'interestedCountry',
  'mainGoal',
  'currentOccupation',
];

export default function IntakePage() {
  const [formData, setFormData] = useState<IntakeFormData>(initialData);

  const riskFlags = useMemo(() => {
    const flags: string[] = [];

    if (formData.previousRefusal === 'Yes') flags.push('Previous visa refusal declared');
    if (formData.previousCancellation === 'Yes') flags.push('Previous visa cancellation declared');
    if (formData.overstayRemoval === 'Yes') flags.push('Overstay/deportation/removal history declared');
    if (formData.criminalHistory === 'Yes') flags.push('Criminal charge/conviction declared');
    if (formData.healthCondition === 'Yes') flags.push('Serious health condition declared');

    return flags;
  }, [formData]);

  const missingKeyItems = keyItems.filter((item) => !formData[item]);
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
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
  };

  return (
    <section className="intake-layout">
      <form className="intake-form" onSubmit={onSubmit}>
        <div className="hero">
          <h1>VPM Intake Questionnaire</h1>
          <p>Please complete all sections for a preliminary migration assessment.</p>
        </div>

        <Fieldset title="Client details">
          <Input label="Full name" value={formData.fullName} onChange={(v) => onChange('fullName', v)} />
          <Input label="Date of birth" type="date" value={formData.dateOfBirth} onChange={(v) => onChange('dateOfBirth', v)} />
          <Input label="Nationality" value={formData.nationality} onChange={(v) => onChange('nationality', v)} />
          <Input label="Country of residence" value={formData.residenceCountry} onChange={(v) => onChange('residenceCountry', v)} />
          <Input label="Residential address" value={formData.address} onChange={(v) => onChange('address', v)} />
          <Input label="Email" type="email" value={formData.email} onChange={(v) => onChange('email', v)} />
          <Input label="Phone" value={formData.phone} onChange={(v) => onChange('phone', v)} />
          <Select label="Preferred contact method" value={formData.contactMethod} options={['Email', 'Phone', 'WhatsApp']} onChange={(v) => onChange('contactMethod', v)} />
        </Fieldset>

        <Fieldset title="Migration goal">
          <Select label="Interested country" value={formData.interestedCountry} options={['Australia', 'New Zealand', 'Both']} onChange={(v) => onChange('interestedCountry', v)} />
          <Select label="Main goal" value={formData.mainGoal} options={['Permanent residency', 'Employer sponsorship', 'Study pathway', 'Visitor visa', 'Partner/family visa', 'Not sure']} onChange={(v) => onChange('mainGoal', v)} />
          <Input label="Desired timeframe" placeholder="e.g. within 12 months" value={formData.timeframe} onChange={(v) => onChange('timeframe', v)} />
        </Fieldset>

        <Fieldset title="Family">
          <Select label="Marital status" value={formData.maritalStatus} options={['Single', 'Married', 'De facto', 'Separated', 'Divorced', 'Widowed']} onChange={(v) => onChange('maritalStatus', v)} />
          <Input label="Number of dependants" type="number" value={formData.dependants} onChange={(v) => onChange('dependants', v)} />
          <Select label="Will partner/dependants migrate with you?" value={formData.migrateWithFamily} options={['Yes', 'No']} onChange={(v) => onChange('migrateWithFamily', v)} />

          {(formData.maritalStatus === 'Married' || formData.maritalStatus === 'De facto') && (
            <div className="conditional-block">
              <h3>Partner details (placeholder)</h3>
              <Input label="Partner full name" value={formData.partnerFullName} onChange={(v) => onChange('partnerFullName', v)} />
              <Input label="Partner nationality" value={formData.partnerNationality} onChange={(v) => onChange('partnerNationality', v)} />
            </div>
          )}
        </Fieldset>

        <Fieldset title="Education">
          <Input label="Highest qualification" value={formData.highestQualification} onChange={(v) => onChange('highestQualification', v)} />
          <Input label="Field of study" value={formData.fieldOfStudy} onChange={(v) => onChange('fieldOfStudy', v)} />
          <Input label="Institution" value={formData.institution} onChange={(v) => onChange('institution', v)} />
          <Input label="Country of study" value={formData.studyCountry} onChange={(v) => onChange('studyCountry', v)} />
          <Input label="Completion year" type="number" value={formData.completionYear} onChange={(v) => onChange('completionYear', v)} />
        </Fieldset>

        <Fieldset title="Employment">
          <Input label="Current occupation" value={formData.currentOccupation} onChange={(v) => onChange('currentOccupation', v)} />
          <Input label="Intended migration occupation" value={formData.migrationOccupation} onChange={(v) => onChange('migrationOccupation', v)} />
          <Input label="Total years of relevant work experience" type="number" value={formData.workExperienceYears} onChange={(v) => onChange('workExperienceYears', v)} />
          <Input label="Current employer" value={formData.currentEmployer} onChange={(v) => onChange('currentEmployer', v)} />
          <TextArea label="Brief duties summary" value={formData.dutiesSummary} onChange={(v) => onChange('dutiesSummary', v)} />
        </Fieldset>

        <Fieldset title="English language">
          <Select label="English test completed?" value={formData.englishTestCompleted} options={['Yes', 'No']} onChange={(v) => onChange('englishTestCompleted', v)} />

          {formData.englishTestCompleted === 'Yes' && (
            <div className="conditional-block">
              <h3>English test details (placeholder)</h3>
              <Input label="Test type" value={formData.englishTestType} onChange={(v) => onChange('englishTestType', v)} />
              <Input label="Test date" type="date" value={formData.englishTestDate} onChange={(v) => onChange('englishTestDate', v)} />
              <Input label="Score summary" value={formData.englishScoreSummary} onChange={(v) => onChange('englishScoreSummary', v)} />
            </div>
          )}
        </Fieldset>

        <Fieldset title="Risk screening">
          <Select label="Any previous visa refusal?" value={formData.previousRefusal} options={['Yes', 'No']} onChange={(v) => onChange('previousRefusal', v)} />
          {formData.previousRefusal === 'Yes' && (
            <TextArea label="Refusal details (placeholder)" value={formData.refusalDetails} onChange={(v) => onChange('refusalDetails', v)} />
          )}
          <Select label="Any previous visa cancellation?" value={formData.previousCancellation} options={['Yes', 'No']} onChange={(v) => onChange('previousCancellation', v)} />
          <Select label="Overstay/deportation/removal history?" value={formData.overstayRemoval} options={['Yes', 'No']} onChange={(v) => onChange('overstayRemoval', v)} />
          <Select label="Any criminal charges or convictions?" value={formData.criminalHistory} options={['Yes', 'No']} onChange={(v) => onChange('criminalHistory', v)} />
          <Select label="Any serious health condition?" value={formData.healthCondition} options={['Yes', 'No']} onChange={(v) => onChange('healthCondition', v)} />

          {(formData.criminalHistory === 'Yes' || formData.previousCancellation === 'Yes') && (
            <TextArea label="Health/character details (placeholder)" value={formData.characterDetails} onChange={(v) => onChange('characterDetails', v)} />
          )}

          {formData.healthCondition === 'Yes' && (
            <TextArea label="Health condition details (placeholder)" value={formData.healthDetails} onChange={(v) => onChange('healthDetails', v)} />
          )}
        </Fieldset>

        <Fieldset title="Documents checklist (placeholder file names)">
          <Input label="Passport bio page" value={formData.passportBioPage} onChange={(v) => onChange('passportBioPage', v)} placeholder="Attach later - placeholder" />
          <Input label="CV / Resume" value={formData.resume} onChange={(v) => onChange('resume', v)} />
          <Input label="Qualifications" value={formData.qualificationsDoc} onChange={(v) => onChange('qualificationsDoc', v)} />
          <Input label="Transcripts" value={formData.transcripts} onChange={(v) => onChange('transcripts', v)} />
          <Input label="English result" value={formData.englishResultDoc} onChange={(v) => onChange('englishResultDoc', v)} />
          <Input label="Refusal/Cancellation documents (if applicable)" value={formData.refusalDocs} onChange={(v) => onChange('refusalDocs', v)} />
        </Fieldset>

        <p className="disclaimer">
          This questionnaire is for preliminary assessment only and does not confirm eligibility or guarantee any visa outcome.
        </p>
      </form>

      <aside className="intake-summary card">
        <h2>Review summary</h2>
        <p><strong>Completion status:</strong> {completionPercent}%</p>
        <p><strong>Estimated readiness:</strong> {readinessStatus}</p>

        <div>
          <h3>Missing key items</h3>
          {missingKeyItems.length === 0 ? <p>None.</p> : <ul>{missingKeyItems.map((item) => <li key={item}>{item}</li>)}</ul>}
        </div>

        <div>
          <h3>Risk flags</h3>
          {riskFlags.length === 0 ? <p>No risk flags currently declared.</p> : <ul>{riskFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul>}
        </div>
      </aside>
    </section>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card intake-fieldset">
      <legend>{title}</legend>
      <div className="input-grid">{children}</div>
    </fieldset>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="field field--full">
      <span>{label}</span>
      <textarea rows={4} {...props} />
    </label>
  );
}
