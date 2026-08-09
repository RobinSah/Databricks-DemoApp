/** Deterministic /api/search payload for E2E runs. */
export const worldBankSearchFixture = {
  provider: "wikipedia",
  results: [
    {
      title: "World Bank",
      url: "https://en.wikipedia.org/wiki/World_Bank",
      snippet:
        "The World Bank is an international financial institution that provides loans and grants to the governments of low- and middle-income countries.",
      source: "wikipedia",
    },
    {
      title: "World Bank Group",
      url: "https://en.wikipedia.org/wiki/World_Bank_Group",
      snippet: "The World Bank Group is a family of five international organizations.",
      source: "wikipedia",
    },
    {
      title: "List of World Bank presidents",
      url: "https://en.wikipedia.org/wiki/List_of_presidents_of_the_World_Bank",
      snippet: "The president of the World Bank Group is the head of the World Bank Group.",
      source: "wikipedia",
    },
  ],
};
