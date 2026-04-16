const AutofillProfileCore = {
    formatCpf(raw) {
        const cleaned = AutofillTextCore.digitsOnly(raw).slice(0, 11);
        if (cleaned.length !== 11) {
            return cleaned;
        }
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    },
    formatPhone(raw) {
        const cleaned = AutofillTextCore.digitsOnly(raw).slice(0, 11);
        if (cleaned.length < 10) {
            return cleaned;
        }
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        }
        return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    },
    formatCep(raw) {
        const cleaned = AutofillTextCore.digitsOnly(raw).slice(0, 8);
        if (cleaned.length !== 8) {
            return cleaned;
        }
        return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2");
    },
    normalizeIsoDate(dateValue) {
        if (!dateValue) {
            return "";
        }
        const parts = String(dateValue).split("-");
        if (parts.length !== 3) {
            return "";
        }
        return `${parts[0]}-${parts[1]}-${parts[2]}`;
    },
    isoToBrDate(dateValue) {
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
    buildProfileFromData(data, states) {
        const cpfRaw = AutofillTextCore.digitsOnly(data.cpf);
        const phoneRaw = AutofillTextCore.digitsOnly(data.phone);
        const cepRaw = AutofillTextCore.digitsOnly(data.cep);
        const normalizedStateCode = String(data.stateCode || "").toUpperCase();
        const stateFromCode = states[normalizedStateCode] || "";
        const stateName = data.stateName || stateFromCode;
        const fullName = data.fullName || [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
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
            phone: AutofillProfileCore.formatPhone(phoneRaw),
            cepRaw,
            cep: AutofillProfileCore.formatCep(cepRaw),
            stateCode: normalizedStateCode,
            stateName,
            birthDate: AutofillProfileCore.normalizeIsoDate(data.birthDate),
            birthDateBr: AutofillProfileCore.isoToBrDate(data.birthDate)
        };
    }
};
//# sourceMappingURL=profile-core.js.map