const AutofillAutofillCore = {
  looksProtected(field: Element): boolean {
    const attrs = [
      field.getAttribute("name"),
      field.getAttribute("id"),
      field.getAttribute("aria-label"),
      field.getAttribute("placeholder"),
      field.getAttribute("autocomplete")
    ]
      .filter(Boolean)
      .map(AutofillTextCore.normalizeText)
      .join(" ");

    return AutofillShared.PROTECTED_HINTS.some((hint) => attrs.includes(hint));
  },

  resolveLabelText(field: Element): string {
    const directLabels = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement
      ? field.labels
        ? Array.from(field.labels)
        : []
      : [];

    if (directLabels.length > 0) {
      return directLabels.map((label) => label.textContent || "").join(" ");
    }

    const parentLabel = field.closest("label");
    if (parentLabel) {
      return parentLabel.textContent || "";
    }

    return "";
  },

  resolveContextText(field: Element): string {
    const collected: string[] = [];
    let current: Element | null = field.parentElement;
    let depth = 0;

    while (current && depth < 5 && collected.length < 3) {
      const text = AutofillAutofillCore.extractContainerText(current);
      const tokenCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

      if (tokenCount > 0 && tokenCount <= 24) {
        collected.push(text);
      }

      current = current.parentElement;
      depth += 1;
    }

    return collected.join(" ");
  },

  extractContainerText(container: Element): string {
    const clone = container.cloneNode(true);
    if (!(clone instanceof Element)) {
      return "";
    }

    clone
      .querySelectorAll("input, select, textarea, button, script, style, noscript, svg")
      .forEach((node) => node.remove());

    const rawText = String(clone.textContent || "").replace(/\s+/g, " ").trim();
    if (!rawText) {
      return "";
    }

    return rawText.slice(0, 120);
  },

  isStrongTokenMatch(text: string, keyword: string): boolean {
    const normalizedText = AutofillTextCore
      .normalizeText(text)
      .replace(/[\s:*.,;!?\-_/]+$/g, "")
      .trim();
    const normalizedKeyword = AutofillTextCore.normalizeText(keyword);

    if (!normalizedText || !normalizedKeyword) {
      return false;
    }

    return normalizedText === normalizedKeyword;
  },

  isIdentifierPatternMatch(identifier: string, keyword: string): boolean {
    const normalizedIdentifier = AutofillTextCore.normalizeForTokenMatch(identifier);
    if (!normalizedIdentifier) {
      return false;
    }

    if (!AutofillTextCore.containsToken(normalizedIdentifier, keyword)) {
      return false;
    }

    // IDs like first-name-input/email-input are strong semantic hints on dynamic forms.
    return /\b(input|field|textbox|value|control|question|answer|element)\b/.test(normalizedIdentifier);
  },

  buildSignals(field: Element) {
    const autocomplete = AutofillTextCore.normalizeText(field.getAttribute("autocomplete") || "");
    const name = AutofillTextCore.normalizeText(field.getAttribute("name") || "");
    const id = AutofillTextCore.normalizeText(field.getAttribute("id") || "");
    const attrLabel = AutofillTextCore.normalizeText(field.getAttribute("label") || "");
    const dataAttrs = AutofillTextCore.normalizeText(
      [
        field.getAttribute("data-test"),
        field.getAttribute("data-testid"),
        field.getAttribute("data-qa"),
        field.getAttribute("data-name"),
        field.getAttribute("data-field"),
        field.getAttribute("data-automation-id"),
        field.getAttribute("data-sr-id")
      ]
        .filter(Boolean)
        .join(" ")
    );
    const placeholder = AutofillTextCore.normalizeText(field.getAttribute("placeholder") || "");
    const aria = AutofillTextCore.normalizeText(field.getAttribute("aria-label") || "");

    let type = "";
    if (field instanceof HTMLInputElement) {
      type = AutofillTextCore.normalizeText(field.type || "");
    }

    const labelText = AutofillTextCore.normalizeText(AutofillAutofillCore.resolveLabelText(field));
    const contextText = AutofillTextCore.normalizeText(AutofillAutofillCore.resolveContextText(field));

    return {
      autocomplete,
      name,
      id,
      attrLabel,
      dataAttrs,
      placeholder,
      aria,
      labelText,
      contextText,
      type
    };
  },

  scoreField(def: AutofillFieldDefinition, field: Element, signals: ReturnType<typeof AutofillAutofillCore.buildSignals>) {
    let score = 0;
    const reasons: Array<{ points: number; source: string; keyword: string }> = [];

    function addPoints(points: number, source: string, keyword?: string) {
      score += points;
      reasons.push({ points, source, keyword: keyword || "" });
    }

    if (signals.type === "email" && def.key === "email") {
      addPoints(50, "type", "email");
    }

    if (signals.type === "tel" && def.key === "phone") {
      addPoints(25, "type", "tel");
    }

    if (
      signals.autocomplete &&
      def.autocomplete.some((token) => signals.autocomplete.includes(token))
    ) {
      addPoints(50, "autocomplete", signals.autocomplete);
    }

    for (const keyword of def.keywords) {
      if (AutofillTextCore.containsToken(signals.name, keyword)) {
        addPoints(40, "name", keyword);
      }

      if (AutofillTextCore.containsToken(signals.id, keyword)) {
        addPoints(30, "id", keyword);
      }

      if (AutofillTextCore.containsToken(signals.dataAttrs, keyword)) {
        addPoints(25, "data_attrs", keyword);
      }

      if (AutofillTextCore.containsToken(signals.labelText, keyword)) {
        addPoints(30, "label", keyword);
      }

      if (AutofillTextCore.containsToken(signals.attrLabel, keyword)) {
        addPoints(35, "attr_label", keyword);
      }

      if (AutofillTextCore.containsToken(signals.contextText, keyword)) {
        addPoints(20, "context", keyword);
      }

      if (
        AutofillTextCore.containsToken(signals.placeholder, keyword) ||
        AutofillTextCore.containsToken(signals.aria, keyword)
      ) {
        addPoints(20, "placeholder_or_aria", keyword);
      }

      if (AutofillAutofillCore.isStrongTokenMatch(signals.labelText, keyword)) {
        addPoints(35, "strong_label", keyword);
      }

      if (AutofillAutofillCore.isStrongTokenMatch(signals.attrLabel, keyword)) {
        addPoints(35, "strong_attr_label", keyword);
      }

      if (AutofillAutofillCore.isIdentifierPatternMatch(signals.id, keyword)) {
        addPoints(35, "id_pattern", keyword);
      }

      if (AutofillAutofillCore.isIdentifierPatternMatch(signals.name, keyword)) {
        addPoints(35, "name_pattern", keyword);
      }

      if (AutofillAutofillCore.isStrongTokenMatch(signals.contextText, keyword)) {
        addPoints(35, "strong_context", keyword);
      }
    }

    if (def.key === "cpf" && field instanceof HTMLInputElement) {
      const maxLen = Number(field.maxLength || 0);
      if ([11, 14].includes(maxLen)) {
        addPoints(10, "maxlength", String(maxLen));
      }
    }

    if (def.key === "cep" && field instanceof HTMLInputElement) {
      const maxLen = Number(field.maxLength || 0);
      if ([8, 9].includes(maxLen)) {
        addPoints(10, "maxlength", String(maxLen));
      }
    }

    return { score, reasons };
  },

  inferField(field: Element): AutofillFieldInference {
    const signals = AutofillAutofillCore.buildSignals(field);
    let best: AutofillFieldInference = { key: "fullName", score: 0, reasons: [] };

    for (const def of AutofillShared.FIELD_DEFINITIONS) {
      const scoreResult = AutofillAutofillCore.scoreField(def, field, signals);
      if (scoreResult.score > best.score) {
        best = { key: def.key, score: scoreResult.score, reasons: scoreResult.reasons };
      }
    }

    return best;
  },

  chooseStateValue(field: Element, userData: Partial<AutofillUserProfile>): string {
    if (field instanceof HTMLSelectElement) {
      return userData.stateCode || userData.stateName || "";
    }

    if (field instanceof HTMLInputElement && Number(field.maxLength) > 0 && field.maxLength <= 2) {
      return userData.stateCode || "";
    }

    return userData.stateName || userData.stateCode || "";
  },

  wantsRawDigits(field: Element): boolean {
    if (!(field instanceof HTMLInputElement)) {
      return false;
    }

    const type = (field.type || "").toLowerCase();
    if (type === "number") {
      return true;
    }

    const maxLen = Number(field.maxLength || 0);
    if (maxLen > 0 && maxLen <= 11) {
      return true;
    }

    const pattern = AutofillTextCore.normalizeText(field.getAttribute("pattern") || "");
    if (/[\.\-()\s]/.test(pattern)) {
      return false;
    }

    return pattern.includes("\\d");
  },

  wantsInternationalPhone(field: Element): boolean {
    const combined = [
      field.getAttribute("name"),
      field.getAttribute("id"),
      field.getAttribute("placeholder"),
      field.getAttribute("aria-label"),
      AutofillAutofillCore.resolveLabelText(field),
      AutofillAutofillCore.resolveContextText(field)
    ]
      .filter(Boolean)
      .map(AutofillTextCore.normalizeText)
      .join(" ");

    if (!combined) {
      return false;
    }

    const intlHints = [
      "country code",
      "dial code",
      "ddi",
      "isd",
      "prefix",
      "codigo pais",
      "codigo do pais",
      "internacional",
      "international",
      "+"
    ];

    return intlHints.some((hint) => combined.includes(hint));
  },

  resolveValue(
    fieldKey: AutofillFieldKey,
    field: Element,
    userData: Partial<AutofillUserProfile>,
    hasSplitName: boolean
  ): string {
    const birth = AutofillTextCore.splitBirthDate(userData.birthDate || userData.birthDateBr || "");

    switch (fieldKey) {
      case "fullName":
        if (hasSplitName) {
          return "";
        }
        return userData.fullName || [userData.firstName, userData.lastName].filter(Boolean).join(" ").trim();
      case "firstName":
        return userData.firstName || "";
      case "lastName":
        return userData.lastName || "";
      case "linkedin":
        return userData.linkedin || "";
      case "github":
        return userData.github || "";
      case "phoneCountry":
        return AutofillAutofillCore.wantsRawDigits(field)
          ? AutofillTextCore.digitsOnly(userData.phoneCountryCode || "")
          : userData.phoneCountryCode || "";
      case "country":
        return userData.country || "";
      case "email":
        return userData.email || "";
      case "cpf":
        return AutofillAutofillCore.wantsRawDigits(field) ? userData.cpfRaw || "" : userData.cpf || userData.cpfRaw || "";
      case "rg":
        return userData.rg || "";
      case "phone":
        if (AutofillAutofillCore.wantsInternationalPhone(field)) {
          return AutofillAutofillCore.wantsRawDigits(field)
            ? userData.phoneIntlRaw || userData.phoneRaw || ""
            : userData.phoneIntl || userData.phone || userData.phoneRaw || "";
        }

        return AutofillAutofillCore.wantsRawDigits(field)
          ? userData.phoneRaw || ""
          : userData.phone || userData.phoneRaw || "";
      case "cep":
        return AutofillAutofillCore.wantsRawDigits(field) ? userData.cepRaw || "" : userData.cep || userData.cepRaw || "";
      case "street":
        return userData.street || "";
      case "number":
        return userData.number || "";
      case "complement":
        return userData.complement || "";
      case "district":
        return userData.district || "";
      case "city":
        return userData.city || "";
      case "state":
        return AutofillAutofillCore.chooseStateValue(field, userData);
      case "birthDate":
        if (field instanceof HTMLInputElement && field.type === "date") {
          return userData.birthDate || "";
        }
        return userData.birthDateBr || "";
      case "birthDay":
        return birth.day;
      case "birthMonth":
        return birth.month;
      case "birthYear":
        return birth.year;
      default:
        return "";
    }
  }
};
