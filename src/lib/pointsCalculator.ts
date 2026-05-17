export type AgeBracket = '18-24' | '25-32' | '33-39' | '40-44' | '45+';
export type OverseasExperience = '0-2' | '3-4' | '5-7' | '8+';
export type AustralianExperience = '0' | '1-2' | '3-4' | '5-7' | '8+';
export type QualificationLevel = 'Doctorate' | 'Bachelor/Masters' | 'Diploma/Trade' | 'No recognised qualification';
export type EnglishLevel = 'Competent' | 'Proficient' | 'Superior';
export type YesNo = 'Yes' | 'No';
export type PartnerPointsCategory = 'Not applicable' | 'Single or partner is AU citizen/PR' | 'Partner has competent English only' | 'Partner has skills + competent English';
export type NominationType = 'None' | 'State nomination (190)' | 'Regional nomination (491)';

export interface PointsCalculatorInput {
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
  englishTestCompleted: YesNo;
  migrationOccupation: string;
  workExperienceYears: string;
  completionYear: string;
}

export type PointsBreakdown = Record<string, number>;

export function calculateEstimatedSkilledMigrationPoints(data: PointsCalculatorInput) {
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
