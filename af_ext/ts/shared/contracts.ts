type AutofillFieldKey =
  | "fullName"
  | "firstName"
  | "lastName"
  | "linkedin"
  | "github"
  | "phoneCountry"
  | "country"
  | "email"
  | "cpf"
  | "rg"
  | "phone"
  | "cep"
  | "street"
  | "number"
  | "complement"
  | "district"
  | "city"
  | "state"
  | "birthDate"
  | "birthDay"
  | "birthMonth"
  | "birthYear";

interface AutofillFieldDefinition {
  key: AutofillFieldKey;
  keywords: string[];
  autocomplete: string[];
}

interface AutofillUserProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  linkedin: string;
  github: string;
  cpf: string;
  cpfRaw: string;
  rg: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
  phoneRaw: string;
  phoneIntl: string;
  phoneIntlRaw: string;
  country: string;
  birthDate: string;
  birthDateBr: string;
  cep: string;
  cepRaw: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  stateCode: string;
  stateName: string;
}

interface AutofillFieldInference {
  key: AutofillFieldKey;
  score: number;
  reasons: Array<{ points: number; source: string; keyword: string }>;
}
