// Curated synthetic fixtures, never represented as conversations saved by this app.
export const examples = [
  {
    id: "example-cough",
    label: "Demo Case A7K2",
    region: "Southern Saskatchewan",
    symptoms: ["Cough", "Tiredness"],
    status: "Completed example",
    flag: "No configured demonstration flag",
    situation: "The fictional participant reports a cough as the main concern.",
    background:
      "User-reported: cough and tiredness for several days, described as mild. Broad region: Southern Saskatchewan. No additional history was supplied.",
    assessment:
      "Reported facts: mild cough and tiredness. Unknown: relevant history, associated symptoms and functional impact. No configured demonstration rule matched this example. This is not a clinical diagnosis or validated triage.",
    recommendation:
      "Prototype action: generated this preloaded demonstration summary. No treatment advice, referral or clinical action was provided.",
  },
  {
    id: "example-headache",
    label: "Demo Case B3M8",
    region: null,
    symptoms: ["Headache"],
    status: "Incomplete example",
    flag: "Missing information · simulated",
    situation:
      "The fictional participant reports a headache as the presenting concern.",
    background:
      "User-reported: a headache beginning within the past day. Severity, history and regional context were not supplied.",
    assessment:
      "Reported fact: recent headache. Unknown: severity, associated symptoms, history and impact. Simulated rule: intake information is incomplete. This flag demonstrates workflow logic and is not clinical triage.",
    recommendation:
      "Prototype action: marked this example incomplete and preserved unknown fields. No independent treatment recommendation was generated.",
  },
];
