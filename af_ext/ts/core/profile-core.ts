const AutofillProfileCore = {
  normalizeDialCode(value: unknown): string {
    const digits = AutofillTextCore.digitsOnly(value).slice(0, 4);
    if (!digits) {
      return "+55";
    }
    return `+${digits}`;
  },

  formatCpf(raw: unknown): string {
    const cleaned = AutofillTextCore.digitsOnly(raw).slice(0, 11);
    if (cleaned.length !== 11) {
      return cleaned;
    }

    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  },

  formatPhone(raw: unknown, phoneCountryCode: unknown): string {
    const cleaned = AutofillTextCore.digitsOnly(raw).slice(0, 15);
    const dialCode = AutofillTextCore.digitsOnly(phoneCountryCode);

    if (dialCode !== "55") {
      return cleaned;
    }

    if (cleaned.length < 10) {
      return cleaned;
    }

    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }

    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  },

  formatInternationalPhone(raw: unknown, phoneCountryCode: unknown): string {
    const national = AutofillTextCore.digitsOnly(raw).slice(0, 15);
    if (!national) {
      return "";
    }

    const dialCode = AutofillProfileCore.normalizeDialCode(phoneCountryCode);
    const dialDigits = AutofillTextCore.digitsOnly(dialCode);

    if (!dialDigits) {
      return national;
    }

    if (dialDigits === "55") {
      if (national.length === 11) {
        return `+55 (${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
      }

      if (national.length === 10) {
        return `+55 (${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
      }
    }

    return `${dialCode} ${national}`.trim();
  },

  formatCep(raw: unknown): string {
    const cleaned = AutofillTextCore.digitsOnly(raw).slice(0, 8);
    if (cleaned.length !== 8) {
      return cleaned;
    }

    return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2");
  },

  normalizeIsoDate(dateValue: unknown): string {
    if (!dateValue) {
      return "";
    }
    const parts = String(dateValue).split("-");
    if (parts.length !== 3) {
      return "";
    }
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  },

  isoToBrDate(dateValue: unknown): string {
    const text = String(dateValue || "");
    if (!text || !text.includes("-")) {
      return "";
    }

    const [year, month, day] = text.split("-");
    if (!year || !month || !day) {
      return "";
    }

    return `${day}/${month}/${year}`;
  },

  buildProfileFromData(
    data: Record<string, string>,
    states: Record<string, string>
  ): AutofillUserProfile {
    const cpfRaw = AutofillTextCore.digitsOnly(data.cpf);
    const phoneRaw = AutofillTextCore.digitsOnly(data.phone).slice(0, 15);
    const cepRaw = AutofillTextCore.digitsOnly(data.cep);
    const phoneCountryCode = AutofillProfileCore.normalizeDialCode(data.phoneCountryCode);
    const phoneCountryDigits = AutofillTextCore.digitsOnly(phoneCountryCode);

    const normalizedStateCode = String(data.stateCode || "").toUpperCase();
    const stateFromCode = states[normalizedStateCode] || "";
    const stateName = data.stateName || stateFromCode;

    const fullName =
      data.fullName || [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
    const [derivedFirstName, ...restNameParts] = fullName.split(/\s+/).filter(Boolean);
    const derivedLastName = restNameParts.join(" ");

    const firstName = data.firstName || derivedFirstName || "";
    const lastName = data.lastName || derivedLastName || "";

    return {
      ...data,
      firstName,
      lastName,
      fullName,
      cpfRaw,
      cpf: AutofillProfileCore.formatCpf(cpfRaw),
      phoneRaw,
      phoneCountryCode,
      phone: AutofillProfileCore.formatPhone(phoneRaw, phoneCountryCode),
      phoneIntl: AutofillProfileCore.formatInternationalPhone(phoneRaw, phoneCountryCode),
      phoneIntlRaw: `${phoneCountryDigits}${phoneRaw}`,
      country: String(data.country || "").trim(),
      cepRaw,
      cep: AutofillProfileCore.formatCep(cepRaw),
      stateCode: normalizedStateCode,
      stateName,
      birthDate: AutofillProfileCore.normalizeIsoDate(data.birthDate),
      birthDateBr: AutofillProfileCore.isoToBrDate(data.birthDate)
    } as AutofillUserProfile;
  }
};
