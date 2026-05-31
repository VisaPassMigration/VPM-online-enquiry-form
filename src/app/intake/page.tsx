'use client';

import React, { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { calculateEstimatedSkilledMigrationPoints } from '@/lib/pointsCalculator';
import { buildCanonicalIntakePayload } from '@/lib/intakePayloadContract';

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
type EnglishLevel = 'Competent' | 'Proficient' | 'Superior';
type AgeBracket = '18-24' | '25-32' | '33-39' | '40-44' | '45+';
type OverseasExperience = '0-2' | '3-4' | '5-7' | '8+';
type AustralianExperience = '0' | '1-2' | '3-4' | '5-7' | '8+';
type QualificationLevel = 'Doctorate' | 'Bachelor/Masters' | 'Diploma/Trade' | 'No recognised qualification';
type PartnerPointsCategory = 'Not applicable' | 'Single or partner is AU citizen/PR' | 'Partner has competent English only' | 'Partner has skills + competent English';
type NominationType = 'None' | 'State nomination (190)' | 'Regional nomination (491)';
type SubmitState = 'idle' | 'submitting' | 'success' | 'error' | 'validation';

type DocumentKey =
  | 'passportBioPage'
  | 'resume'
  | 'qualificationsDoc'
  | 'transcripts'
  | 'englishResultDoc'
  | 'skillsAssessmentDoc'
  | 'refusalDocs'
  | 'otherSupportingDocs';

interface FileUploadConfig {
  key: DocumentKey;
  label: string;
  acceptedTypes: string;
  required: boolean;
}

interface SelectedFileState {
  file: File;
  warning?: string;
}

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
  cancellationOverstayDetails: string;
  criminalDetails: string;
  healthDetails: string;
  ageBracket: AgeBracket;
  englishLevel: EnglishLevel;
  overseasSkilledEmploymentYears: OverseasExperience;
  australianSkilledEmploymentYears: AustralianExperience;
  highestQualificationLevel: QualificationLevel;
  australianStudyRequirementCompleted: YesNo;
  regionalStudyCompleted: YesNo;
  specialistEducationalQualification: YesNo;
  professionalYearCompleted: YesNo;
  naatiCredential: YesNo;
  partnerPointsCategory: PartnerPointsCategory;
  nominationType: NominationType;
  passportBioPage: string;
  resume: string;
  qualificationsDoc: string;
  transcripts: string;
  englishResultDoc: string;
  skillsAssessmentDoc: string;
  refusalDocs: string;
  otherSupportingDocs: string;
}

const DRAFT_KEY = 'vpm-intake-draft-v1';
const SUCCESS_MESSAGE = 'Thank you. Your registration has been submitted to Visa Pass Migration for preliminary review. Our team will review the information provided and contact you if further details or documents are required.';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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
  cancellationOverstayDetails: '',
  criminalDetails: '',
  healthDetails: '',
  ageBracket: '25-32',
  englishLevel: 'Competent',
  overseasSkilledEmploymentYears: '0-2',
  australianSkilledEmploymentYears: '0',
  highestQualificationLevel: 'Bachelor/Masters',
  australianStudyRequirementCompleted: 'No',
  regionalStudyCompleted: 'No',
  specialistEducationalQualification: 'No',
  professionalYearCompleted: 'No',
  naatiCredential: 'No',
  partnerPointsCategory: 'Not applicable',
  nominationType: 'None',
  passportBioPage: '',
  resume: '',
  qualificationsDoc: '',
  transcripts: '',
  englishResultDoc: '',
  skillsAssessmentDoc: '',
  refusalDocs: '',
  otherSupportingDocs: '',
};

const documentUploadConfig: FileUploadConfig[] = [
  { key: 'passportBioPage', label: 'Passport bio page', acceptedTypes: '.pdf,.jpg,.jpeg,.png', required: true },
  { key: 'resume', label: 'CV / resume', acceptedTypes: '.pdf,.doc,.docx', required: true },
  { key: 'qualificationsDoc', label: 'Qualification certificate', acceptedTypes: '.pdf,.jpg,.jpeg,.png', required: true },
  { key: 'transcripts', label: 'Academic transcript', acceptedTypes: '.pdf,.jpg,.jpeg,.png', required: false },
  { key: 'englishResultDoc', label: 'English test result', acceptedTypes: '.pdf,.jpg,.jpeg,.png', required: false },
  { key: 'skillsAssessmentDoc', label: 'Skills assessment', acceptedTypes: '.pdf,.jpg,.jpeg,.png', required: false },
  { key: 'refusalDocs', label: 'Refusal/cancellation evidence', acceptedTypes: '.pdf,.jpg,.jpeg,.png', required: false },
  { key: 'otherSupportingDocs', label: 'Other supporting information', acceptedTypes: '.pdf,.jpg,.jpeg,.png,.doc,.docx', required: false },
];

const requiredFields = {
  fullName: 'Please enter your full name so we know what to call you.',
  email: 'Please share your email so we can contact you with next steps.',
  dateOfBirth: 'Please add your date of birth for eligibility checks.',
  nationality: 'Please add your nationality.',
  residenceCountry: 'Please add your current country of residence.',
  address: 'Please add your residential address.',
  phone: 'Please add your phone number.',
  mainGoal: 'Please select your main migration goal.',
  timeframe: 'Please share your preferred timeframe.',
  currentOccupation: 'Please add your current occupation.',
  workExperienceYears: 'Please add your approximate years of work experience.',
} as const;

const keyItems = Object.keys(requiredFields) as Array<keyof typeof requiredFields>;

const sectionNav = [
  { id: 'client-details', label: 'Client details', optional: false },
  { id: 'migration-goal', label: 'Migration goal', optional: false },
  { id: 'family', label: 'Family / partner', optional: true },
  { id: 'education', label: 'Education', optional: true },
  { id: 'employment', label: 'Employment', optional: false },
  { id: 'english-language', label: 'English', optional: true },
  { id: 'risk-screening', label: 'Health/Character/Visa Refusal Declaration', optional: true },
  { id: 'documents', label: 'Document preparation', optional: true },
  { id: 'points-estimator', label: 'Preliminary points estimate', optional: true },
  { id: 'review-summary', label: 'Review summary', optional: true },
] as const;

type SectionId = (typeof sectionNav)[number]['id'];

const sectionMissingHints: Record<SectionId, string> = {
  'client-details': 'Please complete your personal and contact details.',
  'migration-goal': 'Please confirm your preferred destination, goal, and timing.',
  family: 'Family details are optional unless a partner or dependants will be included.',
  education: 'Education details can help VPM understand qualification evidence.',
  employment: 'Please add your current occupation and work experience.',
  'english-language': 'English evidence is optional now unless you have completed a test.',
  'risk-screening': 'Please complete any required declaration details if you answer Yes.',
  documents: 'Document selections are optional preparation only at this stage.',
  'points-estimator': 'The preliminary points estimate uses your current answers.',
  'review-summary': 'Review the summary before submitting your registration.',
};

const pointsBreakdownLabels: Record<string, string> = {
  age: 'Age',
  english: 'English language',
  overseasEmployment: 'Overseas skilled employment',
  australianEmployment: 'Australian skilled employment',
  qualification: 'Qualification',
  australianStudy: 'Australian study',
  regionalStudy: 'Regional study',
  specialistQualification: 'Specialist education',
  professionalYear: 'Professional year',
  naati: 'Community language / NAATI',
  partner: 'Partner points',
  nomination: 'State or regional nomination',
};

const getInitialData = () => ({ ...initialData });

export default function IntakePage() {
  const [formData, setFormData] = useState<IntakeFormData>(() => getInitialData());
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof IntakeFormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof IntakeFormData, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [draftStatus, setDraftStatus] = useState('Autosaving draft locally…');
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<DocumentKey, SelectedFileState>>>({});
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [formResetKey, setFormResetKey] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const skipNextAutosave = useRef(false);

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(DRAFT_KEY);
    if (!savedDraft) {
      setDraftReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(savedDraft) as Partial<IntakeFormData & { __savedAt: string }>;
      const { __savedAt, ...rest } = parsed;
      setFormData((prev) => ({ ...prev, ...rest }));
      if (__savedAt) setLastSavedAt(__savedAt);
      setDraftStatus('Saved draft restored from this browser.');
    } catch {
      setDraftStatus('We could not restore a previous draft. You can continue with a new one.');
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;

    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }

    const savedAt = new Date().toISOString();
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...formData, __savedAt: savedAt }));
    setLastSavedAt(savedAt);
    setDraftStatus('Draft saved locally on this device.');
  }, [draftReady, formData]);

  const pointsEstimate = useMemo(() => calculateEstimatedSkilledMigrationPoints(formData), [formData]);
  const shouldShowEnglishDetails = formData.englishTestCompleted === 'Yes';
  const shouldShowPartnerDetails = ['Married', 'De facto'].includes(formData.maritalStatus) || formData.migrateWithFamily === 'Yes';
  const requiresRefusalDetails = formData.previousRefusal === 'Yes';
  const requiresCancellationDetails = formData.previousCancellation === 'Yes' || formData.overstayRemoval === 'Yes';
  const requiresCriminalDetails = formData.criminalHistory === 'Yes';
  const requiresHealthDetails = formData.healthCondition === 'Yes';

  const riskFlags = useMemo(() => {
    const flags: string[] = [];
    if (formData.previousRefusal === 'Yes') flags.push('Previous visa refusal declared');
    if (formData.previousCancellation === 'Yes') flags.push('Previous visa cancellation declared');
    if (formData.overstayRemoval === 'Yes') flags.push('Overstay/removal history declared');
    if (formData.criminalHistory === 'Yes') flags.push('Character history declared');
    if (formData.healthCondition === 'Yes') flags.push('Health condition declared');
    if (pointsEstimate.estimatedTotalPoints < 65) flags.push('Preliminary points may need pathway strategy');
    return flags;
  }, [formData, pointsEstimate.estimatedTotalPoints]);

  const missingKeyItems = keyItems.filter((item) => !formData[item].trim());
  const missingRequiredDocuments = documentUploadConfig
    .filter((doc) => doc.required && !selectedFiles[doc.key]?.file)
    .map((doc) => doc.label);

  const readinessStatus = riskFlags.length > 0
    ? 'Needs VPM review'
    : pointsEstimate.estimatedTotalPoints < 65
      ? 'Pathway strategy may be needed'
      : missingKeyItems.length > 0
        ? 'In progress'
        : 'Ready for preliminary review';

  const sectionCompletion = useMemo(() => {
    const completionChecks: Record<SectionId, boolean> = {
      'client-details': Boolean(formData.fullName && formData.dateOfBirth && formData.nationality && formData.residenceCountry && formData.address && formData.email && formData.phone && formData.contactMethod),
      'migration-goal': Boolean(formData.mainGoal && formData.interestedCountry && formData.timeframe),
      family: Boolean(formData.maritalStatus && formData.migrateWithFamily && (!shouldShowPartnerDetails || (formData.partnerFullName && formData.partnerNationality))),
      education: Boolean(formData.highestQualification || formData.fieldOfStudy || formData.institution || formData.completionYear),
      employment: Boolean(formData.currentOccupation && formData.workExperienceYears),
      'english-language': Boolean(formData.englishTestCompleted && (formData.englishTestCompleted === 'No' || (formData.englishTestType && formData.englishScoreSummary))),
      'risk-screening': Boolean(!requiresRefusalDetails && !requiresCancellationDetails && !requiresCriminalDetails && !requiresHealthDetails) || Boolean((!requiresRefusalDetails || formData.refusalDetails) && (!requiresCancellationDetails || formData.cancellationOverstayDetails) && (!requiresCriminalDetails || formData.criminalDetails) && (!requiresHealthDetails || formData.healthDetails)),
      documents: missingRequiredDocuments.length === 0,
      'points-estimator': true,
      'review-summary': missingKeyItems.length === 0,
    };

    return sectionNav.map((section) => ({ ...section, complete: completionChecks[section.id] }));
  }, [formData, missingKeyItems.length, missingRequiredDocuments.length, requiresCancellationDetails, requiresCriminalDetails, requiresHealthDetails, requiresRefusalDetails, shouldShowPartnerDetails]);

  const firstMissingSection = sectionCompletion.find((section) => !section.complete && !section.optional);
  const completeCount = sectionCompletion.filter((section) => section.complete).length;
  const hasRiskDisclosure = riskFlags.some((flag) => flag.includes('declared'));

  const validate = (data: IntakeFormData) => {
    const errors: Partial<Record<keyof IntakeFormData, string>> = {};
    keyItems.forEach((field) => {
      if (!data[field]?.trim()) errors[field] = requiredFields[field];
    });
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Please enter a valid email address (for example, name@example.com).';
    if (data.englishTestCompleted === 'Yes' && !data.englishTestType.trim()) errors.englishTestType = 'Please add your English test type.';
    if (data.englishTestCompleted === 'Yes' && !data.englishScoreSummary.trim()) errors.englishScoreSummary = 'Please add your English score summary.';
    if (['Married', 'De facto'].includes(data.maritalStatus) || data.migrateWithFamily === 'Yes') {
      if (!data.partnerFullName.trim()) errors.partnerFullName = 'Please add partner full name.';
      if (!data.partnerNationality.trim()) errors.partnerNationality = 'Please add partner nationality.';
    }
    if (data.previousRefusal === 'Yes' && !data.refusalDetails.trim()) errors.refusalDetails = 'Please add refusal details.';
    if ((data.previousCancellation === 'Yes' || data.overstayRemoval === 'Yes') && !data.cancellationOverstayDetails.trim()) errors.cancellationOverstayDetails = 'Please add cancellation, overstay, or removal details.';
    if (data.criminalHistory === 'Yes' && !data.criminalDetails.trim()) errors.criminalDetails = 'Please add character history details.';
    if (data.healthCondition === 'Yes' && !data.healthDetails.trim()) errors.healthDetails = 'Please add health condition details.';
    return errors;
  };

  const onChange = (field: keyof IntakeFormData, value: string) => {
    const nextData = { ...formData, [field]: value };
    setFormData(nextData);
    if (submitAttempted || touched[field]) setValidationErrors(validate(nextData));
  };

  const onBlur = (field: keyof IntakeFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setValidationErrors(validate(formData));
  };

  const onSelectFile = (key: DocumentKey, acceptedTypes: string, files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      setSelectedFiles((prev) => ({ ...prev, [key]: undefined }));
      return;
    }

    const allowedExtensions = acceptedTypes.split(',').map((type) => type.trim().replace('.', '').toLowerCase());
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const warning = file.size > MAX_FILE_SIZE_BYTES
      ? 'This file is larger than 10MB. VPM may ask for a smaller version.'
      : allowedExtensions.includes(extension)
        ? undefined
        : 'This file type may not be accepted later. PDF/JPG/PNG is usually safest.';

    setSelectedFiles((prev) => ({ ...prev, [key]: { file, warning } }));
  };

  const jumpToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const clearSavedDraft = () => {
    window.localStorage.removeItem(DRAFT_KEY);
    skipNextAutosave.current = true;
    setFormData(getInitialData());
    setSelectedFiles({});
    setValidationErrors({});
    setTouched({});
    setSubmitAttempted(false);
    setSubmitState('idle');
    setSubmitMessage('');
    setLastSavedAt(null);
    setFormResetKey((key) => key + 1);
    setDraftStatus('Saved draft cleared. The registration form has been reset.');
  };

  const shouldShowError = (field: keyof IntakeFormData) => Boolean(validationErrors[field] && (submitAttempted || touched[field]));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    const errors = validate(formData);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitState('validation');
      setSubmitMessage('Please complete the required sections before submitting.');
      return;
    }

    setSubmitState('submitting');
    setSubmitMessage('Submitting registration…');

    try {
      const documents = documentUploadConfig.flatMap((doc) => {
        const selected = selectedFiles[doc.key];
        return selected?.file
          ? [{ documentType: doc.key, originalFilename: selected.file.name, mimeType: selected.file.type || 'application/octet-stream', fileSizeBytes: selected.file.size, uploadedBy: 'client' as const }]
          : [];
      });
      const payload = buildCanonicalIntakePayload(formData, pointsEstimate.estimatedTotalPoints, documents);
      const createResponse = await fetch('/api/intakes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const createBody = await createResponse.json();
      if (!createResponse.ok) {
        setSubmitMessage(createResponse.status === 400 ? 'Please review the required information.' : 'Something went wrong. Please try again or contact VPM.');
        setSubmitState('error');
        return;
      }

      const submitResponse = await fetch(`/api/intakes/${createBody.submissionId}/submit`, { method: 'POST' });
      if (!submitResponse.ok) {
        setSubmitMessage('Something went wrong while submitting your registration. Please try again or contact VPM.');
        setSubmitState('error');
        return;
      }

      setSubmitState('success');
      setSubmitMessage('Registration submitted to VPM for preliminary review.');
    } catch {
      setSubmitState('error');
      setSubmitMessage('Something went wrong. Please try again or contact VPM.');
    }
  };

  return (
    <section className="intake-page">
      <div className="intake-hero">
        <p className="eyebrow">Client Registration Form</p>
        <h1>Visa Pass Migration: Client Registration Form</h1>
        <p>
          Please complete the sections below so Visa Pass Migration can complete a preliminary review of your background, goals, and possible migration pathway.
        </p>
      </div>

      <section className="section progress-card" aria-labelledby="progress-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Your progress</p>
            <h2 id="progress-title">Registration sections</h2>
          </div>
          <p className="active-filter-summary">{completeCount} of {sectionCompletion.length} sections look complete or okay for now.</p>
        </div>
        <div className="section-nav progress-chip-grid">
          {sectionCompletion.map((section) => (
            <a key={section.id} href={`#${section.id}`} className={section.complete ? 'progress-chip progress-chip--complete' : section.optional ? 'progress-chip progress-chip--optional' : 'progress-chip progress-chip--attention'}>
              <strong>{section.label}</strong>
              <span>{section.complete ? 'Complete' : section.optional ? 'Optional / okay for now' : 'Needs attention'}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="intake-layout">
        <form id="client-registration-form" key={formResetKey} className="intake-form" onSubmit={onSubmit}>
          <SectionCard id="client-details" title="Client details" helper="Start with your personal and contact information. Required fields are marked clearly.">
            <Input required label="Full name" value={formData.fullName} error={shouldShowError('fullName') ? validationErrors.fullName : undefined} onBlur={() => onBlur('fullName')} onChange={(v) => onChange('fullName', v)} />
            <Input required label="Date of birth" type="date" value={formData.dateOfBirth} error={shouldShowError('dateOfBirth') ? validationErrors.dateOfBirth : undefined} onBlur={() => onBlur('dateOfBirth')} onChange={(v) => onChange('dateOfBirth', v)} />
            <Input required label="Nationality" value={formData.nationality} error={shouldShowError('nationality') ? validationErrors.nationality : undefined} onBlur={() => onBlur('nationality')} onChange={(v) => onChange('nationality', v)} />
            <Input required label="Country of residence" value={formData.residenceCountry} error={shouldShowError('residenceCountry') ? validationErrors.residenceCountry : undefined} onBlur={() => onBlur('residenceCountry')} onChange={(v) => onChange('residenceCountry', v)} />
            <Input required label="Residential address" value={formData.address} error={shouldShowError('address') ? validationErrors.address : undefined} onBlur={() => onBlur('address')} onChange={(v) => onChange('address', v)} />
            <Input required label="Email" type="email" value={formData.email} error={shouldShowError('email') ? validationErrors.email : undefined} onBlur={() => onBlur('email')} onChange={(v) => onChange('email', v)} />
            <Input required label="Phone" value={formData.phone} error={shouldShowError('phone') ? validationErrors.phone : undefined} onBlur={() => onBlur('phone')} onChange={(v) => onChange('phone', v)} />
            <Select required label="Preferred contact method" value={formData.contactMethod} options={['Email', 'Phone', 'WhatsApp']} error={shouldShowError('contactMethod') ? validationErrors.contactMethod : undefined} onBlur={() => onBlur('contactMethod')} onChange={(v) => onChange('contactMethod', v)} />
          </SectionCard>

          <SectionCard id="migration-goal" title="Migration goal" helper="Tell us what pathway or outcome you would like VPM to consider first.">
            <Select required label="Interested country" value={formData.interestedCountry} options={['Australia', 'New Zealand', 'Both']} onChange={(v) => onChange('interestedCountry', v)} />
            <Select required label="Main goal" value={formData.mainGoal} options={['Permanent residency', 'Employer sponsorship', 'Study pathway', 'Visitor visa', 'Partner/family visa', 'Not sure']} error={shouldShowError('mainGoal') ? validationErrors.mainGoal : undefined} onBlur={() => onBlur('mainGoal')} onChange={(v) => onChange('mainGoal', v)} />
            <Input required label="Preferred timeframe" value={formData.timeframe} error={shouldShowError('timeframe') ? validationErrors.timeframe : undefined} onBlur={() => onBlur('timeframe')} onChange={(v) => onChange('timeframe', v)} />
          </SectionCard>

          <SectionCard id="family" title="Family / partner" helper="Household details can affect options, evidence, and points.">
            <Select label="Marital status" value={formData.maritalStatus} options={['Single', 'Married', 'De facto', 'Separated', 'Divorced', 'Widowed']} onChange={(v) => onChange('maritalStatus', v)} />
            <Input label="Number of dependants" type="number" min="0" value={formData.dependants} onChange={(v) => onChange('dependants', v)} />
            <Select label="Migrate with family" value={formData.migrateWithFamily} options={['Yes', 'No']} onChange={(v) => onChange('migrateWithFamily', v)} />
            {shouldShowPartnerDetails ? <>
              <Input required label="Partner full name" value={formData.partnerFullName} error={shouldShowError('partnerFullName') ? validationErrors.partnerFullName : undefined} onBlur={() => onBlur('partnerFullName')} onChange={(v) => onChange('partnerFullName', v)} />
              <Input required label="Partner nationality" value={formData.partnerNationality} error={shouldShowError('partnerNationality') ? validationErrors.partnerNationality : undefined} onBlur={() => onBlur('partnerNationality')} onChange={(v) => onChange('partnerNationality', v)} />
            </> : null}
          </SectionCard>

          <SectionCard id="education" title="Education" helper="Education details help VPM understand qualification evidence and possible points claims.">
            <Input label="Highest qualification" value={formData.highestQualification} onChange={(v) => onChange('highestQualification', v)} />
            <Input label="Field of study" value={formData.fieldOfStudy} onChange={(v) => onChange('fieldOfStudy', v)} />
            <Input label="Institution" value={formData.institution} onChange={(v) => onChange('institution', v)} />
            <Input label="Study country" value={formData.studyCountry} onChange={(v) => onChange('studyCountry', v)} />
            <Input label="Completion year" value={formData.completionYear} onChange={(v) => onChange('completionYear', v)} />
          </SectionCard>

          <SectionCard id="employment" title="Employment" helper="Work history helps determine pathway fit, evidence needs, and readiness.">
            <Input required label="Current occupation" value={formData.currentOccupation} error={shouldShowError('currentOccupation') ? validationErrors.currentOccupation : undefined} onBlur={() => onBlur('currentOccupation')} onChange={(v) => onChange('currentOccupation', v)} />
            <Input label="Nominated migration occupation" value={formData.migrationOccupation} onChange={(v) => onChange('migrationOccupation', v)} />
            <Input required label="Approximate years of work experience" value={formData.workExperienceYears} error={shouldShowError('workExperienceYears') ? validationErrors.workExperienceYears : undefined} onBlur={() => onBlur('workExperienceYears')} onChange={(v) => onChange('workExperienceYears', v)} />
            <Input label="Current employer" value={formData.currentEmployer} onChange={(v) => onChange('currentEmployer', v)} />
            <label className="field field--full"><span>Duties summary</span><textarea value={formData.dutiesSummary} onChange={(event) => onChange('dutiesSummary', event.target.value)} rows={4} /></label>
          </SectionCard>

          <SectionCard id="english-language" title="English" helper="English test information helps VPM understand eligibility and possible points claims.">
            <Select label="English test completed" value={formData.englishTestCompleted} options={['Yes', 'No']} onChange={(v) => onChange('englishTestCompleted', v)} />
            {shouldShowEnglishDetails ? <>
              <Input required label="Test type" value={formData.englishTestType} error={shouldShowError('englishTestType') ? validationErrors.englishTestType : undefined} onBlur={() => onBlur('englishTestType')} onChange={(v) => onChange('englishTestType', v)} />
              <Input label="Test date" type="date" value={formData.englishTestDate} onChange={(v) => onChange('englishTestDate', v)} />
              <Input required label="Score summary" value={formData.englishScoreSummary} error={shouldShowError('englishScoreSummary') ? validationErrors.englishScoreSummary : undefined} onBlur={() => onBlur('englishScoreSummary')} onChange={(v) => onChange('englishScoreSummary', v)} />
            </> : null}
          </SectionCard>

          <SectionCard id="risk-screening" title="Health/Character/Visa Refusal Declaration" helper="Please disclose any health, character, visa refusal, cancellation, overstay, or removal history. These details help VPM understand whether senior review or further information may be required.">
            <Select label="Previous visa refusal" value={formData.previousRefusal} options={['Yes', 'No']} onChange={(v) => onChange('previousRefusal', v)} />
            {requiresRefusalDetails ? <Input required label="Refusal details" value={formData.refusalDetails} error={shouldShowError('refusalDetails') ? validationErrors.refusalDetails : undefined} onBlur={() => onBlur('refusalDetails')} onChange={(v) => onChange('refusalDetails', v)} /> : null}
            <Select label="Previous visa cancellation" value={formData.previousCancellation} options={['Yes', 'No']} onChange={(v) => onChange('previousCancellation', v)} />
            <Select label="Overstay, removal, or deportation history" value={formData.overstayRemoval} options={['Yes', 'No']} onChange={(v) => onChange('overstayRemoval', v)} />
            <Select label="Character history" value={formData.criminalHistory} options={['Yes', 'No']} onChange={(v) => onChange('criminalHistory', v)} />
            {requiresCancellationDetails ? <Input required label="Cancellation, overstay, or removal details" value={formData.cancellationOverstayDetails} error={shouldShowError('cancellationOverstayDetails') ? validationErrors.cancellationOverstayDetails : undefined} onBlur={() => onBlur('cancellationOverstayDetails')} onChange={(v) => onChange('cancellationOverstayDetails', v)} /> : null}
            {requiresCriminalDetails ? <Input required label="Character history details" value={formData.criminalDetails} error={shouldShowError('criminalDetails') ? validationErrors.criminalDetails : undefined} onBlur={() => onBlur('criminalDetails')} onChange={(v) => onChange('criminalDetails', v)} /> : null}
            <Select label="Health condition" value={formData.healthCondition} options={['Yes', 'No']} onChange={(v) => onChange('healthCondition', v)} />
            {requiresHealthDetails ? <Input required label="Health details" value={formData.healthDetails} error={shouldShowError('healthDetails') ? validationErrors.healthDetails : undefined} onBlur={() => onBlur('healthDetails')} onChange={(v) => onChange('healthDetails', v)} /> : null}
          </SectionCard>

          <SectionCard id="documents" title="Document preparation" helper="Document upload selection is currently for preliminary review preparation only. VPM may request documents again through a confirmed secure channel if required.">
            {documentUploadConfig.map((doc) => (
              <label key={doc.key} className="field file-field">
                <span>{doc.label} {doc.required ? <em className="required-indicator" aria-label="required">*</em> : null}</span>
                <input type="file" accept={doc.acceptedTypes} onChange={(event) => onSelectFile(doc.key, doc.acceptedTypes, event.target.files)} />
                {selectedFiles[doc.key]?.file ? <small>Selected: {selectedFiles[doc.key]?.file.name}</small> : <small>Preparation only — VPM may request final upload instructions later.</small>}
                {selectedFiles[doc.key]?.warning ? <small className="field-error">{selectedFiles[doc.key]?.warning}</small> : null}
              </label>
            ))}
          </SectionCard>

          <SectionCard id="points-estimator" title="Preliminary skilled migration points estimate" helper="This estimate is a guide only and must be reviewed by VPM against current migration rules and evidence.">
            <Select label="Age bracket" value={formData.ageBracket} options={['18-24', '25-32', '33-39', '40-44', '45+']} onChange={(v) => onChange('ageBracket', v)} />
            <Select label="English level" value={formData.englishLevel} options={['Competent', 'Proficient', 'Superior']} onChange={(v) => onChange('englishLevel', v)} />
            <Select label="Overseas skilled employment years" value={formData.overseasSkilledEmploymentYears} options={['0-2', '3-4', '5-7', '8+']} onChange={(v) => onChange('overseasSkilledEmploymentYears', v)} />
            <Select label="Australian skilled employment years" value={formData.australianSkilledEmploymentYears} options={['0', '1-2', '3-4', '5-7', '8+']} onChange={(v) => onChange('australianSkilledEmploymentYears', v)} />
            <Select label="Highest qualification level" value={formData.highestQualificationLevel} options={['Doctorate', 'Bachelor/Masters', 'Diploma/Trade', 'No recognised qualification']} onChange={(v) => onChange('highestQualificationLevel', v)} />
            <Select label="Australian study completed" value={formData.australianStudyRequirementCompleted} options={['Yes', 'No']} onChange={(v) => onChange('australianStudyRequirementCompleted', v)} />
            <Select label="Regional study completed" value={formData.regionalStudyCompleted} options={['Yes', 'No']} onChange={(v) => onChange('regionalStudyCompleted', v)} />
            <Select label="Specialist education completed" value={formData.specialistEducationalQualification} options={['Yes', 'No']} onChange={(v) => onChange('specialistEducationalQualification', v)} />
            <Select label="Professional year completed" value={formData.professionalYearCompleted} options={['Yes', 'No']} onChange={(v) => onChange('professionalYearCompleted', v)} />
            <Select label="Community language / NAATI credential" value={formData.naatiCredential} options={['Yes', 'No']} onChange={(v) => onChange('naatiCredential', v)} />
            <Select label="Partner points category" value={formData.partnerPointsCategory} options={['Not applicable', 'Single or partner is AU citizen/PR', 'Partner has competent English only', 'Partner has skills + competent English']} onChange={(v) => onChange('partnerPointsCategory', v)} />
            <Select label="State or regional nomination" value={formData.nominationType} options={['None', 'State nomination (190)', 'Regional nomination (491)']} onChange={(v) => onChange('nominationType', v)} />
          </SectionCard>

          <div className="form-submit-bar card">
            <button type="button" className="secondary-btn" onClick={clearSavedDraft}>Clear saved draft</button>
            {firstMissingSection ? <button type="button" className="secondary-btn" onClick={() => jumpToSection(firstMissingSection.id)}>Jump to first missing section</button> : null}
            <button type="submit" className="primary-btn" disabled={submitState === 'submitting'}>{submitState === 'submitting' ? 'Submitting…' : 'Submit Registration'}</button>
            <p className="draft-status" role="status">{submitMessage || draftStatus}{lastSavedAt ? ` Last saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
            {submitState === 'success' ? <p className="draft-status">{SUCCESS_MESSAGE}</p> : null}
          </div>
        </form>

        <aside id="review-summary" className="intake-summary card">
          <p className="eyebrow">Review summary</p>
          <h2>Your preliminary review snapshot</h2>
          <p><strong>Registration readiness:</strong> {readinessStatus}</p>
          {firstMissingSection
            ? <p className="missing-hint"><strong>Next step:</strong> {sectionMissingHints[firstMissingSection.id]}</p>
            : <p className="missing-hint"><strong>Next step:</strong> Review and submit when ready.</p>}
          <div className="summary-actions">
            {firstMissingSection ? <button type="button" className="secondary-btn" onClick={() => jumpToSection(firstMissingSection.id)}>Jump to first missing section</button> : null}
            {hasRiskDisclosure ? <button type="button" className="secondary-btn" onClick={() => jumpToSection('risk-screening')}>Review declaration</button> : null}
          </div>

          <div className="points-summary">
            <h3>Preliminary points estimate</h3>
            <p className="points-total">{pointsEstimate.estimatedTotalPoints}</p>
            <p><strong>Indicative range:</strong> {pointsEstimate.potentialRange}</p>
            <dl className="points-breakdown-list">
              {Object.entries(pointsEstimate.breakdown).map(([key, value]) => (
                <div key={key}>
                  <dt>{pointsBreakdownLabels[key] ?? key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p><strong>Items that may affect this estimate:</strong> {pointsEstimate.missingItems.length ? pointsEstimate.missingItems.join(', ') : 'None identified from entered data.'}</p>
            <p className="disclaimer">Preliminary estimate only. Your final points position must be reviewed by VPM against current migration rules and supporting evidence.</p>
          </div>

          <div className="summary-mini-card">
            <h3>Declaration notes</h3>
            <p>{riskFlags.length ? riskFlags.join(', ') : 'No health, character, refusal, cancellation, overstay, or removal declarations from current answers.'}</p>
          </div>
          <div className="summary-mini-card">
            <h3>Document preparation</h3>
            <p>{missingRequiredDocuments.length ? missingRequiredDocuments.join(', ') : 'Key preparation documents have been selected in this session.'}</p>
          </div>
          <div className="summary-mini-card">
            <h3>English and work experience</h3>
            <p>{formData.englishTestCompleted === 'Yes' ? 'English test marked as completed.' : 'English test not yet completed.'}</p>
            <p>{formData.workExperienceYears ? `${formData.workExperienceYears} year(s) declared.` : 'Work experience years not yet declared.'}</p>
          </div>
        </aside>
      </section>

      <section className="final-submit-card card" aria-labelledby="final-submit-title">
        <div>
          <p className="eyebrow">Final step</p>
          <h2 id="final-submit-title">Submit your registration to VPM</h2>
          <p>When the information above is ready, submit your Registration Form so VPM can begin preliminary review.</p>
          <p className="success-message" hidden>{SUCCESS_MESSAGE}</p>
          {submitState === 'success' ? <p className="success-message" role="status">{SUCCESS_MESSAGE}</p> : null}
          {submitState === 'validation' ? <p className="field-error" role="alert">Please complete the required sections before submitting. Use “Jump to first missing section” if you need help finding the next item.</p> : null}
        </div>
        <div className="final-submit-card__actions">
          {firstMissingSection ? <button type="button" className="secondary-btn" onClick={() => jumpToSection(firstMissingSection.id)}>Jump to first missing section</button> : null}
          <button type="submit" form="client-registration-form" className="primary-btn final-submit-button" disabled={submitState === 'submitting'}>
            {submitState === 'submitting' ? 'Submitting…' : 'Submit Registration'}
          </button>
        </div>
      </section>
    </section>
  );
}

function SectionCard({ id, title, helper, children }: { id: string; title: string; helper: string; children: ReactNode }) {
  return (
    <section id={id} className="card intake-fieldset">
      <div className="intake-card-header">
        <h2>{title}</h2>
        <p>{helper}</p>
      </div>
      <div className="input-grid">{children}</div>
    </section>
  );
}

function Input({ label, onChange, error, required, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; error?: string; onChange: (value: string) => void }) {
  return (
    <label className={`field ${error ? 'field--error' : ''}`}>
      <span>{label} {required ? <em className="required-indicator" aria-label="required">Required</em> : null}</span>
      <input {...props} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function Select({ label, options, onChange, error, required, ...props }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & { label: string; options: string[]; error?: string; onChange: (value: string) => void }) {
  return (
    <label className={`field ${error ? 'field--error' : ''}`}>
      <span>{label} {required ? <em className="required-indicator" aria-label="required">Required</em> : null}</span>
      <select {...props} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}
