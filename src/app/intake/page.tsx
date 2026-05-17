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
type EnglishLevel = 'Competent' | 'Proficient' | 'Superior';
type AgeBracket = '18-24' | '25-32' | '33-39' | '40-44' | '45+';
type OverseasExperience = '0-2' | '3-4' | '5-7' | '8+';
type AustralianExperience = '0' | '1-2' | '3-4' | '5-7' | '8+';
type QualificationLevel = 'Doctorate' | 'Bachelor/Masters' | 'Diploma/Trade' | 'No recognised qualification';
type PartnerPointsCategory = 'Not applicable' | 'Single or partner is AU citizen/PR' | 'Partner has competent English only' | 'Partner has skills + competent English';
type NominationType = 'None' | 'State nomination (190)' | 'Regional nomination (491)';

type DocumentKey =
  | 'passportBioPage'
  | 'resume'
  | 'qualificationsDoc'
  | 'transcripts'
  | 'englishResultDoc'
  | 'skillsAssessmentDoc'
  | 'refusalDocs'
  | 'otherSupportingDocs';

interface FileUploadConfig { key: DocumentKey; label: string; acceptedTypes: string; required: boolean; }
interface SelectedFileState { file: File; warning?: string; }

interface IntakeFormData {
  fullName: string; dateOfBirth: string; nationality: string; residenceCountry: string; address: string; email: string; phone: string;
  contactMethod: ContactMethod; interestedCountry: InterestedCountry; mainGoal: MigrationGoal; timeframe: string; maritalStatus: MaritalStatus;
  dependants: string; migrateWithFamily: YesNo; partnerFullName: string; partnerNationality: string;
  highestQualification: string; fieldOfStudy: string; institution: string; studyCountry: string; completionYear: string;
  currentOccupation: string; migrationOccupation: string; workExperienceYears: string; currentEmployer: string; dutiesSummary: string;
  englishTestCompleted: YesNo; englishTestType: string; englishTestDate: string; englishScoreSummary: string;
  previousRefusal: YesNo; refusalDetails: string; previousCancellation: YesNo; overstayRemoval: YesNo; criminalHistory: YesNo; healthCondition: YesNo;
  characterDetails: string; healthDetails: string;
  ageBracket: AgeBracket; englishLevel: EnglishLevel; overseasSkilledEmploymentYears: OverseasExperience; australianSkilledEmploymentYears: AustralianExperience;
  highestQualificationLevel: QualificationLevel; australianStudyRequirementCompleted: YesNo; regionalStudyCompleted: YesNo;
  specialistEducationalQualification: YesNo; professionalYearCompleted: YesNo; naatiCredential: YesNo;
  partnerPointsCategory: PartnerPointsCategory; nominationType: NominationType;
  passportBioPage: string; resume: string; qualificationsDoc: string; transcripts: string; englishResultDoc: string; skillsAssessmentDoc: string; refusalDocs: string; otherSupportingDocs: string;
}

type PointsBreakdown = Record<string, number>;

function calculateEstimatedSkilledMigrationPoints(data: IntakeFormData) {
  // Preliminary estimator only: this front-end logic must be verified against current migration legislation/policy before production use.
  const breakdown: PointsBreakdown = {
    age: { '18-24': 25, '25-32': 30, '33-39': 25, '40-44': 15, '45+': 0 }[data.ageBracket],
    english: { Competent: 0, Proficient: 10, Superior: 20 }[data.englishLevel],
    overseasEmployment: { '0-2': 0, '3-4': 5, '5-7': 10, '8+': 15 }[data.overseasSkilledEmploymentYears],
    australianEmployment: { '0': 0, '1-2': 5, '3-4': 10, '5-7': 15, '8+': 20 }[data.australianSkilledEmploymentYears],
    qualification: { Doctorate: 20, 'Bachelor/Masters': 15, 'Diploma/Trade': 10, 'No recognised qualification': 0 }[data.highestQualificationLevel],
    australianStudy: data.australianStudyRequirementCompleted === 'Yes' ? 5 : 0,
    regionalStudy: data.regionalStudyCompleted === 'Yes' ? 5 : 0,
    specialistQualification: data.specialistEducationalQualification === 'Yes' ? 10 : 0,
    professionalYear: data.professionalYearCompleted === 'Yes' ? 5 : 0,
    naati: data.naatiCredential === 'Yes' ? 5 : 0,
    partner: {
      'Not applicable': 0,
      'Single or partner is AU citizen/PR': 10,
      'Partner has competent English only': 5,
      'Partner has skills + competent English': 10,
    }[data.partnerPointsCategory],
    nomination: { None: 0, 'State nomination (190)': 5, 'Regional nomination (491)': 15 }[data.nominationType],
  };

  const estimatedTotalPoints = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  const potentialRange = `${Math.max(0, estimatedTotalPoints - 5)}-${estimatedTotalPoints + 5}`;

  const missingItems: string[] = [];
  if (data.englishTestCompleted === 'No') missingItems.push('English test evidence');
  if (!data.migrationOccupation.trim()) missingItems.push('Nominated migration occupation');
  if (!data.workExperienceYears.trim()) missingItems.push('Detailed work experience evidence');
  if (!data.completionYear.trim()) missingItems.push('Qualification completion year/evidence');

  return { estimatedTotalPoints, potentialRange, breakdown, missingItems };
}

const DRAFT_KEY = 'vpm-intake-draft-v1';
const initialData: IntakeFormData = { fullName: '', dateOfBirth: '', nationality: '', residenceCountry: '', address: '', email: '', phone: '', contactMethod: 'Email', interestedCountry: 'Australia', mainGoal: 'Not sure', timeframe: '', maritalStatus: 'Single', dependants: '', migrateWithFamily: 'No', partnerFullName: '', partnerNationality: '', highestQualification: '', fieldOfStudy: '', institution: '', studyCountry: '', completionYear: '', currentOccupation: '', migrationOccupation: '', workExperienceYears: '', currentEmployer: '', dutiesSummary: '', englishTestCompleted: 'No', englishTestType: '', englishTestDate: '', englishScoreSummary: '', previousRefusal: 'No', refusalDetails: '', previousCancellation: 'No', overstayRemoval: 'No', criminalHistory: 'No', healthCondition: 'No', characterDetails: '', healthDetails: '', ageBracket: '25-32', englishLevel: 'Competent', overseasSkilledEmploymentYears: '0-2', australianSkilledEmploymentYears: '0', highestQualificationLevel: 'Bachelor/Masters', australianStudyRequirementCompleted: 'No', regionalStudyCompleted: 'No', specialistEducationalQualification: 'No', professionalYearCompleted: 'No', naatiCredential: 'No', partnerPointsCategory: 'Not applicable', nominationType: 'None', passportBioPage: '', resume: '', qualificationsDoc: '', transcripts: '', englishResultDoc: '', skillsAssessmentDoc: '', refusalDocs: '', otherSupportingDocs: '' };
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const documentUploadConfig: FileUploadConfig[] = [
  { key: 'passportBioPage', label: 'Passport bio page', acceptedTypes: '.pdf,.jpg,.jpeg,.png', required: true },
  { key: 'resume', label: 'CV / resume', acceptedTypes: '.pdf,.doc,.docx', required: true },
  { key: 'qualificationsDoc', label: 'Qualification certificate', acceptedTypes: '.pdf,.jpg,.jpeg,.png,.doc,.docx', required: true },
  { key: 'transcripts', label: 'Academic transcript', acceptedTypes: '.pdf,.jpg,.jpeg,.png,.doc,.docx', required: true },
  { key: 'englishResultDoc', label: 'English test result', acceptedTypes: '.pdf,.jpg,.jpeg,.png,.doc,.docx', required: false },
  { key: 'skillsAssessmentDoc', label: 'Skills assessment (if available)', acceptedTypes: '.pdf,.jpg,.jpeg,.png,.doc,.docx', required: false },
  { key: 'refusalDocs', label: 'Visa refusal or cancellation letter (if applicable)', acceptedTypes: '.pdf,.jpg,.jpeg,.png,.doc,.docx', required: false },
  { key: 'otherSupportingDocs', label: 'Other supporting documents', acceptedTypes: '.pdf,.jpg,.jpeg,.png,.doc,.docx', required: false },
];

const sectionNav = [{ id: 'client-details', label: 'Client details' }, { id: 'migration-goal', label: 'Migration goal' }, { id: 'family', label: 'Family' }, { id: 'education', label: 'Education' }, { id: 'employment', label: 'Employment' }, { id: 'points-estimator', label: 'Points estimator' }, { id: 'english-language', label: 'English language' }, { id: 'risk-screening', label: 'Risk screening' }, { id: 'documents', label: 'Documents' }] as const;
const requiredFields = { fullName: 'Please enter your full name so we know what to call you.', email: 'Please share your email so we can contact you with next steps.', dateOfBirth: 'Please add your date of birth for eligibility checks.', nationality: 'Please add your nationality.', residenceCountry: 'Please add your current country of residence.', phone: 'Please add your phone number in case we need to reach you quickly.', mainGoal: 'Please choose the migration goal that best matches your plans.', currentOccupation: 'Please add your current occupation.' };
const keyItems = Object.keys(requiredFields) as Array<keyof typeof requiredFields>;

export default function IntakePage() { const [formData, setFormData] = useState<IntakeFormData>(initialData); const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof IntakeFormData, string>>>({}); const [touched, setTouched] = useState<Partial<Record<keyof IntakeFormData, boolean>>>({}); const [submitAttempted, setSubmitAttempted] = useState(false); const [draftStatus, setDraftStatus] = useState('Autosaving draft locally…'); const [selectedFiles, setSelectedFiles] = useState<Partial<Record<DocumentKey, SelectedFileState>>>({});
useEffect(() => { const savedDraft = window.localStorage.getItem(DRAFT_KEY); if (!savedDraft) return; try { const parsed = JSON.parse(savedDraft) as Partial<IntakeFormData>; setFormData((prev) => ({ ...prev, ...parsed })); setDraftStatus('Saved draft restored from this browser.'); } catch { setDraftStatus('We could not restore a previous draft. You can continue with a new one.'); } }, []);
useEffect(() => { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(formData)); setDraftStatus('Draft saved locally on this device.'); }, [formData]);

const pointsEstimate = useMemo(() => calculateEstimatedSkilledMigrationPoints(formData), [formData]);
const riskFlags = useMemo(() => { const flags: string[] = []; if (formData.previousRefusal === 'Yes') flags.push('Previous visa refusal declared'); if (formData.previousCancellation === 'Yes') flags.push('Previous visa cancellation declared'); if (formData.overstayRemoval === 'Yes') flags.push('Overstay/deportation/removal history declared'); if (formData.criminalHistory === 'Yes') flags.push('Criminal charge/conviction declared'); if (formData.healthCondition === 'Yes') flags.push('Serious health condition declared'); if (pointsEstimate.estimatedTotalPoints < 65) flags.push('Estimated points may be below common invitation thresholds'); return flags; }, [formData, pointsEstimate.estimatedTotalPoints]);
const requiredRiskDocuments = useMemo(() => { const docs: string[] = []; if (formData.previousRefusal === 'Yes' || formData.previousCancellation === 'Yes') docs.push('Visa refusal or cancellation letter'); if (formData.overstayRemoval === 'Yes') docs.push('Overstay/removal evidence and timeline notes'); if (formData.criminalHistory === 'Yes') docs.push('Police/court documents'); if (formData.healthCondition === 'Yes') docs.push('Medical reports'); return docs; }, [formData]);
const validate = (data: IntakeFormData) => { const errors: Partial<Record<keyof IntakeFormData, string>> = {}; keyItems.forEach((field) => { if (!data[field]?.trim()) errors[field] = requiredFields[field]; }); if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Please enter a valid email address (for example, name@example.com).'; return errors; };
const missingKeyItems = keyItems.filter((item) => !formData[item].trim()); const missingRequiredDocuments = documentUploadConfig.filter((doc) => doc.required && !selectedFiles[doc.key]?.file).map((doc) => doc.label); const readinessStatus = riskFlags.length > 0 ? 'Needs consultant review' : pointsEstimate.estimatedTotalPoints < 65 ? 'Likely needs pathway strategy' : missingKeyItems.length > 0 ? 'In progress' : 'Appears ready for preliminary review';
const onChange = (field: keyof IntakeFormData, value: string) => { setFormData((prev) => ({ ...prev, [field]: value })); if (submitAttempted || touched[field]) setValidationErrors(validate({ ...formData, [field]: value })); };
const onBlur = (field: keyof IntakeFormData) => { setTouched((prev) => ({ ...prev, [field]: true })); setValidationErrors(validate(formData)); };
const onSubmit = (event: FormEvent) => { event.preventDefault(); setSubmitAttempted(true); const errors = validate(formData); setValidationErrors(errors); if (Object.keys(errors).length > 0) return; };
const clearSavedDraft = () => { window.localStorage.removeItem(DRAFT_KEY); setFormData(initialData); setValidationErrors({}); setTouched({}); setSubmitAttempted(false); setDraftStatus('Saved draft cleared. You can start again anytime.'); };
const shouldShowError = (field: keyof IntakeFormData) => Boolean(validationErrors[field] && (submitAttempted || touched[field]));
const onSelectFile = (key: DocumentKey, acceptedTypes: string, fileList: FileList | null) => { if (!fileList?.[0]) return; const file = fileList[0]; const acceptedExtensions = acceptedTypes.split(',').map((entry) => entry.trim().toLowerCase()); const extension = `.${file.name.split('.').pop()?.toLowerCase()}`; let warning = ''; if (!acceptedExtensions.includes(extension)) warning = 'This file type is not supported for this field.'; else if (file.size > MAX_FILE_SIZE_BYTES) warning = 'This file is larger than 10MB.'; setSelectedFiles((prev) => ({ ...prev, [key]: { file, warning } })); };

return <section className="intake-layout"><form className="intake-form" onSubmit={onSubmit} noValidate>
<div className="hero"><h1>VPM Intake Questionnaire</h1><p>Please complete all sections for a preliminary migration assessment.</p><p className="draft-status">{draftStatus}</p><button type="button" className="secondary-btn" onClick={clearSavedDraft}>Clear saved draft</button></div>
<nav className="section-nav card" aria-label="Questionnaire sections">{sectionNav.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}</nav>
<Fieldset id="client-details" title="Client details" helper="Your personal and contact details help us prepare your profile."><Input required label="Full name" value={formData.fullName} error={shouldShowError('fullName') ? validationErrors.fullName : undefined} onBlur={() => onBlur('fullName')} onChange={(v) => onChange('fullName', v)} /><Input required label="Date of birth" type="date" value={formData.dateOfBirth} error={shouldShowError('dateOfBirth') ? validationErrors.dateOfBirth : undefined} onBlur={() => onBlur('dateOfBirth')} onChange={(v) => onChange('dateOfBirth', v)} /><Input required label="Nationality" value={formData.nationality} error={shouldShowError('nationality') ? validationErrors.nationality : undefined} onBlur={() => onBlur('nationality')} onChange={(v) => onChange('nationality', v)} /><Input required label="Country of residence" value={formData.residenceCountry} error={shouldShowError('residenceCountry') ? validationErrors.residenceCountry : undefined} onBlur={() => onBlur('residenceCountry')} onChange={(v) => onChange('residenceCountry', v)} /><Input required label="Email" type="email" value={formData.email} error={shouldShowError('email') ? validationErrors.email : undefined} onBlur={() => onBlur('email')} onChange={(v) => onChange('email', v)} /><Input required label="Phone" value={formData.phone} error={shouldShowError('phone') ? validationErrors.phone : undefined} onBlur={() => onBlur('phone')} onChange={(v) => onChange('phone', v)} /></Fieldset>
<Fieldset id="points-estimator" title="Estimated skilled migration points (preliminary)" helper="Front-end-only points estimator. Requires VPM review before any visa decision.">
<Select label="Age bracket" value={formData.ageBracket} options={['18-24','25-32','33-39','40-44','45+']} onChange={(v) => onChange('ageBracket', v)} />
<Select label="English level" value={formData.englishLevel} options={['Competent','Proficient','Superior']} onChange={(v) => onChange('englishLevel', v)} />
<Select label="Overseas skilled employment years" value={formData.overseasSkilledEmploymentYears} options={['0-2','3-4','5-7','8+']} onChange={(v) => onChange('overseasSkilledEmploymentYears', v)} />
<Select label="Australian skilled employment years" value={formData.australianSkilledEmploymentYears} options={['0','1-2','3-4','5-7','8+']} onChange={(v) => onChange('australianSkilledEmploymentYears', v)} />
<Select label="Highest qualification level" value={formData.highestQualificationLevel} options={['Doctorate','Bachelor/Masters','Diploma/Trade','No recognised qualification']} onChange={(v) => onChange('highestQualificationLevel', v)} />
<Select label="Australian study requirement completed" value={formData.australianStudyRequirementCompleted} options={['Yes','No']} onChange={(v) => onChange('australianStudyRequirementCompleted', v)} />
<Select label="Regional study completed" value={formData.regionalStudyCompleted} options={['Yes','No']} onChange={(v) => onChange('regionalStudyCompleted', v)} />
<Select label="Specialist educational qualification" value={formData.specialistEducationalQualification} options={['Yes','No']} onChange={(v) => onChange('specialistEducationalQualification', v)} />
<Select label="Professional year completed" value={formData.professionalYearCompleted} options={['Yes','No']} onChange={(v) => onChange('professionalYearCompleted', v)} />
<Select label="NAATI / community language credential" value={formData.naatiCredential} options={['Yes','No']} onChange={(v) => onChange('naatiCredential', v)} />
<Select label="Partner points category" value={formData.partnerPointsCategory} options={['Not applicable','Single or partner is AU citizen/PR','Partner has competent English only','Partner has skills + competent English']} onChange={(v) => onChange('partnerPointsCategory', v)} />
<Select label="State / regional nomination" value={formData.nominationType} options={['None','State nomination (190)','Regional nomination (491)']} onChange={(v) => onChange('nominationType', v)} />
</Fieldset></form>
<aside className="intake-summary card"><h2>Review summary</h2><p><strong>Estimated readiness:</strong> {readinessStatus}</p><div className="points-summary"><h3>Estimated points</h3><p className="points-total">{pointsEstimate.estimatedTotalPoints}</p><p><strong>Potential points range:</strong> {pointsEstimate.potentialRange}</p><ul>{Object.entries(pointsEstimate.breakdown).map(([k,v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}</ul><p><strong>Missing items that may affect points:</strong> {pointsEstimate.missingItems.length ? pointsEstimate.missingItems.join(', ') : 'None identified from entered data.'}</p><p className="disclaimer">Preliminary estimate only. Estimated points require VPM review and verification against current migration rules before use in production advice.</p></div><h3>Risk flags</h3><p>{riskFlags.length ? riskFlags.join(', ') : 'No risk flags from current answers.'}</p><h3>Missing key documents</h3><p>{missingRequiredDocuments.length ? missingRequiredDocuments.join(', ') : 'All key required uploads selected in this session.'}</p><h3>English status</h3><p>{formData.englishTestCompleted === 'Yes' ? 'English test marked as completed.' : 'English test not yet completed.'}</p><h3>Work experience status</h3><p>{formData.workExperienceYears ? `${formData.workExperienceYears} year(s) declared.` : 'Work experience years not yet declared.'}</p></aside></section>;
}

function Fieldset({ id, title, helper, children }: { id: string; title: string; helper: string; children: ReactNode }) { return <fieldset id={id} className="card intake-fieldset"><legend>{title}</legend><p className="fieldset-helper">{helper}</p><div className="input-grid">{children}</div></fieldset>; }
function Input({ label, onChange, error, required, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; error?: string; onChange: (value: string) => void }) { return <label className={`field ${error ? 'field--error' : ''}`}><span>{label} {required ? <em className="required-indicator" aria-label="required">*</em> : null}</span><input {...props} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error ? <small className="field-error">{error}</small> : null}</label>; }
function Select({ label, options, onChange, error, required, ...props }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & { label: string; options: string[]; error?: string; onChange: (value: string) => void }) { return <label className={`field ${error ? 'field--error' : ''}`}><span>{label} {required ? <em className="required-indicator" aria-label="required">*</em> : null}</span><select {...props} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{error ? <small className="field-error">{error}</small> : null}</label>; }
