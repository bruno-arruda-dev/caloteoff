import { getSetting, setSetting } from '../database/settingsRepository';

export type PlanType = 'free' | 'monthly' | 'annual' | 'lifetime';

export interface LicenseState {
  isPremium: boolean;
  planType: PlanType;
  activatedAt?: string;
}

const SETTING_KEY_IS_PREMIUM = 'is_premium';
const SETTING_KEY_PLAN_TYPE = 'license_plan_type';
const SETTING_KEY_ACTIVATED_AT = 'license_activated_at';

export async function getLicenseState(): Promise<LicenseState> {
  try {
    const isPremiumStr = await getSetting(SETTING_KEY_IS_PREMIUM);
    const planTypeStr = await getSetting(SETTING_KEY_PLAN_TYPE);
    const activatedAt = await getSetting(SETTING_KEY_ACTIVATED_AT);

    const isPremium = isPremiumStr === 'true';
    const planType: PlanType = (planTypeStr as PlanType) || (isPremium ? 'annual' : 'free');

    return {
      isPremium,
      planType,
      activatedAt: activatedAt || undefined,
    };
  } catch (error) {
    console.warn('Erro ao carregar status da licença do SQLite:', error);
    return {
      isPremium: false,
      planType: 'free',
    };
  }
}

export async function setLicensePlan(plan: Exclude<PlanType, 'free'>): Promise<void> {
  const now = new Date().toISOString();
  await setSetting(SETTING_KEY_IS_PREMIUM, 'true');
  await setSetting(SETTING_KEY_PLAN_TYPE, plan);
  await setSetting(SETTING_KEY_ACTIVATED_AT, now);
}

export async function resetLicenseToFree(): Promise<void> {
  await setSetting(SETTING_KEY_IS_PREMIUM, 'false');
  await setSetting(SETTING_KEY_PLAN_TYPE, 'free');
}
