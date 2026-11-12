export interface AllergyConflict {
  allergen: string;
  contraindicatedMedicine: string;
  severity: 'CRITICAL' | 'WARNING';
  clinicalRationale: string;
}

export interface DrugInteractionWarning {
  drugA: string;
  drugB: string;
  severity: 'FATAL' | 'MODERATE' | 'MILD';
  mechanism: string;
}

const ALLERGY_CONTRAINDICATIONS: Record<string, string[]> = {
  penicillin: ['amoxicillin', 'ampicillin', 'augmentin', 'piperacillin', 'penicillin', 'ceftriaxone', 'cephalexin'],
  shellfish: ['glucosamine', 'iodinated contrast'],
  aspirin: ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac']
};

const DRUG_DRUG_INTERACTIONS: DrugInteractionWarning[] = [
  {
    drugA: 'lisinopril',
    drugB: 'spironolactone',
    severity: 'FATAL',
    mechanism: 'Severe hyperkalemia risk; dual blockade of renin-angiotensin-aldosterone axis can trigger cardiac arrest.'
  },
  {
    drugA: 'warfarin',
    drugB: 'aspirin',
    severity: 'FATAL',
    mechanism: 'Potentiated anticoagulation; exponentially increases risk of major gastrointestinal and intracerebral hemorrhage.'
  },
  {
    drugA: 'metformin',
    drugB: 'contrast media',
    severity: 'MODERATE',
    mechanism: 'Lactic acidosis risk; withhold 48 hours prior to iodinated radiological contrast studies.'
  }
];

export const checkAllergySafety = (patientAllergies: string[], candidateMedicine: string): AllergyConflict | null => {
  const targetMed = candidateMedicine.trim().toLowerCase();
  for (const allergy of patientAllergies) {
    const cleanAllergy = allergy.toLowerCase();
    for (const [key, contraindicatedList] of Object.entries(ALLERGY_CONTRAINDICATIONS)) {
      if (cleanAllergy.includes(key)) {
        if (contraindicatedList.some(med => targetMed.includes(med))) {
          return {
            allergen: allergy,
            contraindicatedMedicine: candidateMedicine,
            severity: 'CRITICAL',
            clinicalRationale: `Documented anaphylactoid allergy: "${allergy}". Prescribing "${candidateMedicine}" is strictly blocked.`
          };
        }
      }
    }
  }
  return null;
};

export const checkDrugInteractions = (activeMeds: string[], newMedicine: string): DrugInteractionWarning | null => {
  const target = newMedicine.trim().toLowerCase();
  for (const active of activeMeds) {
    const act = active.toLowerCase();
    for (const rule of DRUG_DRUG_INTERACTIONS) {
      if ((target.includes(rule.drugA) && act.includes(rule.drugB)) || (target.includes(rule.drugB) && act.includes(rule.drugA))) {
        return rule;
      }
    }
  }
  return null;
};
