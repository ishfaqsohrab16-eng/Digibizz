/**
 * Recovering a readable answer from whatever the model actually said.
 *
 * The assistant asks for its answer through the present_answer tool, and most
 * of the time that is what it gets. But the router chooses from a catalogue of
 * hundreds of free models by whoever has capacity, and some of them answer in
 * prose instead - especially after a long chain of tool calls, and especially
 * the reasoning models. What reached the screen was this, verbatim:
 *
 *   Okay, let me try to figure out what's going on here. The user asked for
 *   all details about student ID 56201 ... I need to inform the user clearly
 *   that the student doesn't exist and suggest verifying the ID.
 *   </think>
 *
 *   <error>
 *   The student with std_id 56201 does not exist in the database.
 *   </error>
 *
 *   <summary>
 *   No data found for student ID 56201 ...
 *   </summary>
 *
 *   <visuals>
 *   </visuals>
 *
 * Three separate problems in one reply, and all three are recoverable:
 *
 *   THE REASONING LEAKED. Providers usually strip a <think> block into a
 *   separate field, but not always, and here the opening tag was taken and the
 *   closing one left behind - so the answer began mid-thought with no marker
 *   at all until a stray </think> several paragraphs later.
 *
 *   IT INVENTED A PROTOCOL. Having been given a tool with summary and visuals,
 *   it wrote them as XML. The content is right; only the wrapper is wrong.
 *
 *   THE REAL ANSWER WAS IN THERE. Two sentences of it, under the noise.
 *
 * Salvaging beats re-prompting: another round costs a request against a rate
 * limit that is already the binding constraint, and would probably produce the
 * same thing again.
 */

/** Tags a model uses to mark thinking it did not mean to publish. */
const REASONING_TAGS = "think|thinking|thought|reasoning|scratchpad|internal";

/**
 * Remove the model's private reasoning.
 *
 * The dangling-closing-tag case is the one that matters and the one that is
 * easy to miss: with no opening tag to match, a naive paired-tag strip leaves
 * the entire monologue in place and deletes nothing.
 */
const stripReasoning = (text) => {
  let out = text;

  // Properly paired blocks first.
  out = out.replace(new RegExp(`<(${REASONING_TAGS})>[\\s\\S]*?<\\/\\1>`, "gi"), "");

  // A closing tag with nothing opening it: everything before it was thinking.
  // The LAST one, because a reply may have thought more than once.
  const closing = new RegExp(`<\\/(?:${REASONING_TAGS})>`, "gi");
  let lastEnd = -1;
  let match;
  while ((match = closing.exec(out)) !== null) lastEnd = match.index + match[0].length;
  if (lastEnd !== -1) out = out.slice(lastEnd);

  // An opening tag with nothing closing it: the reply ran out mid-thought, so
  // everything after it is thinking.
  out = out.replace(new RegExp(`<(?:${REASONING_TAGS})>[\\s\\S]*$`, "gi"), "");

  return out.trim();
};

/** The contents of <name>...</name>, if the model wrote one. */
const section = (text, name) => {
  const match = text.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? match[1].trim() : null;
};

/**
 * Remove any XML-ish tags left over.
 *
 * Conservative on purpose: only things that look like real tags. A comparison
 * written out in prose - "students < 20" - or an email address in angle
 * brackets must survive, because mangling the answer to tidy it is worse than
 * leaving a stray bracket in.
 */
const stripTags = (text) =>
  text
    .replace(/<\/?[a-z_][\w.-]*\s*\/?>/gi, "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * The whole answer, written as a JSON object rather than called as a tool.
 *
 * Seen live: `{ "summary": "Across the three training centres, male enrolment
 * is consistently higher...", "visuals": [...] }`. The model had the shape
 * exactly right and simply printed it instead of calling present_answer, so
 * the envelope reached the screen along with the answer.
 *
 * Recognised only when it really is that envelope - an object with a string
 * summary. Any other JSON a model might quote, a row of data or a fragment of
 * a query result, is left as prose, because turning it into an answer would be
 * a guess.
 */
const parseAnswerObject = (text) => {
  // Fences come off first. A model that prints its answer as an object very
  // often puts it in a ```json block, and the fence would otherwise sit
  // outside the braces and fail the whole-string test below.
  const trimmed = text.replace(/```[a-z]*/gi, "").trim();

  // The braces have to bound the whole thing. A sentence that merely mentions
  // an object is prose about JSON, not JSON.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  if (trimmed.slice(0, start).trim() || trimmed.slice(end + 1).trim()) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    const usable =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
      typeof parsed.summary === "string" && parsed.summary.trim();

    return usable ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Visuals written as nested XML rather than as JSON.
 *
 * Seen verbatim from a reasoning model that answered in prose:
 *
 *   <visuals>
 *     <visual>
 *       <type>bar</type>
 *       <title>Quiz Scores Distribution</title>
 *       <queryIndex>9</queryIndex>
 *       <xField>quiz_code</xField>
 *       <yFields>["marks_obt"]</yFields>
 *     </visual>
 *   </visuals>
 *
 * Every field the tool defines is there and correct. Only the encoding is
 * wrong, and throwing three good charts away over that would be perverse.
 *
 * queryIndex has to become a number and yFields an array; both arrive as text
 * whichever way the model wrote them.
 */
const visualsFromXml = (xml) => {
  const visuals = [];

  // The INNER content of each block, not the block itself. Scanning the whole
  // element for fields matches its own <visual> wrapper first, consumes
  // everything up to </visual> as one field called "visual", and finds none of
  // the real ones.
  const blocks = [...xml.matchAll(/<visual>([\s\S]*?)<\/visual>/gi)].map((match) => match[1]);

  for (const block of blocks) {
    const visual = {};

    for (const [, name, value] of block.matchAll(/<([a-z][\w]*)>([\s\S]*?)<\/\1>/gi)) {
      const text = value.trim();
      if (!text) continue;

      if (name === "queryIndex") {
        const index = Number(text);
        if (Number.isFinite(index)) visual.queryIndex = index;
      } else if (name === "yFields") {
        try {
          const parsed = JSON.parse(text);
          visual.yFields = Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          // A bare name, or a comma-separated list of them.
          visual.yFields = text.split(",").map((entry) => entry.trim()).filter(Boolean);
        }
      } else {
        visual[name] = text;
      }
    }

    if (visual.type) visuals.push(visual);
  }

  return visuals;
};

/**
 * The answer, and any visuals it managed to describe.
 *
 * Used both for a prose reply and, defensively, for the summary field of a
 * proper present_answer call - a model that leaks its reasoning into content
 * will happily leak it into a tool argument too.
 */
const cleanAnswerText = (raw) => {
  const text = String(raw || "").trim();
  if (!text) return { summary: "", visuals: [] };

  const withoutReasoning = stripReasoning(text);

  // The third encoding seen in the wild: the whole present_answer payload,
  // written out as a JSON object instead of called as a tool. Left alone it
  // reaches the screen as `{ "summary": "Across the three training centres...`
  // - the answer is right there, wrapped in its own envelope.
  const asObject = parseAnswerObject(withoutReasoning);
  if (asObject) {
    return {
      summary: stripTags(String(asObject.summary || "")),
      visuals: Array.isArray(asObject.visuals) ? asObject.visuals : [],
    };
  }

  // Its own tags, in order of preference. <error> is a real finding - "this
  // student does not exist" is the answer to the question that was asked, not
  // a failure - so it is used when there is no summary.
  const summary =
    section(withoutReasoning, "summary") ||
    section(withoutReasoning, "answer") ||
    section(withoutReasoning, "error") ||
    withoutReasoning;

  // It may have written the visuals as JSON, or - having been shown a tool
  // schema and decided to answer in XML - as nested <visual> elements. Both
  // are read. They are checked against the real columns afterwards regardless,
  // so a bad guess costs nothing and a lost chart costs a whole answer's
  // worth of illustration.
  let visuals = [];
  const described = section(withoutReasoning, "visuals");

  if (described) {
    try {
      const parsed = JSON.parse(described);
      if (Array.isArray(parsed)) visuals = parsed;
    } catch {
      visuals = visualsFromXml(described);
    }
  }

  return { summary: stripTags(summary), visuals };
};

module.exports = {
  cleanAnswerText,
  _internals: { stripReasoning, stripTags, section },
};
