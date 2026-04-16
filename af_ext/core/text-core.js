const AutofillTextCore = {
    normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    },
    containsToken(text, token) {
        if (!text || !token) {
            return false;
        }
        const normalizedText = ` ${AutofillTextCore.normalizeText(text)} `;
        const normalizedToken = ` ${AutofillTextCore.normalizeText(token)} `;
        return normalizedText.includes(normalizedToken);
    },
    digitsOnly(value) {
        return String(value || "").replace(/\D+/g, "");
    },
    splitBirthDate(value) {
        if (!value) {
            return { day: "", month: "", year: "" };
        }
        if (value.includes("-")) {
            const [year, month, day] = value.split("-");
            return { day: day || "", month: month || "", year: year || "" };
        }
        if (value.includes("/")) {
            const [day, month, year] = value.split("/");
            return { day: day || "", month: month || "", year: year || "" };
        }
        return { day: "", month: "", year: "" };
    },
    maskValuePreview(fieldKey, value) {
        if (!value) {
            return "";
        }
        const rawValue = String(value);
        if (["cpf", "rg", "phone", "cep"].includes(fieldKey)) {
            const digits = rawValue.replace(/\D+/g, "");
            if (!digits) {
                return "***";
            }
            if (digits.length <= 3) {
                return "*".repeat(digits.length);
            }
            return `${"*".repeat(digits.length - 3)}${digits.slice(-3)}`;
        }
        if (fieldKey === "email") {
            const [local, domain] = rawValue.split("@");
            if (!domain) {
                return "***";
            }
            const localPreview = (local || "").slice(0, 2);
            return `${localPreview}***@${domain}`;
        }
        if (rawValue.length <= 40) {
            return rawValue;
        }
        return `${rawValue.slice(0, 37)}...`;
    }
};
//# sourceMappingURL=text-core.js.map