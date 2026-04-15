import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JSDOM } from "jsdom";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { writeFileSync } from "fs";

const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

type WorldTopology = any;

// Country lookup: maps names, alpha-2, and alpha-3 codes to ISO 3166-1 numeric codes
const COUNTRY_LOOKUP: Record<string, string> = {
  // Major countries
  "us": "840", "usa": "840", "united states": "840", "united states of america": "840",
  "cn": "156", "chn": "156", "china": "156", "people's republic of china": "156",
  "in": "356", "ind": "356", "india": "356",
  "id": "360", "idn": "360", "indonesia": "360",
  "pk": "586", "pak": "586", "pakistan": "586",
  "br": "076", "bra": "076", "brazil": "076",
  "ng": "566", "nga": "566", "nigeria": "566",
  "bd": "050", "bgd": "050", "bangladesh": "050",
  "ru": "643", "rus": "643", "russia": "643", "russian federation": "643",
  "mx": "484", "mex": "484", "mexico": "484",
  "jp": "392", "jpn": "392", "japan": "392",
  "et": "231", "eth": "231", "ethiopia": "231",
  "ph": "608", "phl": "608", "philippines": "608",
  "eg": "818", "egy": "818", "egypt": "818",
  "vn": "704", "vnm": "704", "vietnam": "704", "viet nam": "704",
  "cd": "180", "cod": "180", "congo, democratic republic of the": "180", "dr congo": "180", "democratic republic of the congo": "180",
  "tr": "792", "tur": "792", "turkey": "792", "türkiye": "792",
  "ir": "364", "irn": "364", "iran": "364", "iran, islamic republic of": "364",
  "de": "276", "deu": "276", "germany": "276",
  "th": "764", "tha": "764", "thailand": "764",
  "gb": "826", "gbr": "826", "united kingdom": "826", "uk": "826", "great britain": "826",
  "fr": "250", "fra": "250", "france": "250",
  "it": "380", "ita": "380", "italy": "380",
  "za": "710", "zaf": "710", "south africa": "710",
  "tz": "834", "tza": "834", "tanzania": "834", "united republic of tanzania": "834",
  "mm": "104", "mmr": "104", "myanmar": "104",
  "ke": "404", "ken": "404", "kenya": "404",
  "kr": "410", "kor": "410", "south korea": "410", "korea, republic of": "410", "republic of korea": "410",
  "co": "170", "col": "170", "colombia": "170",
  "es": "724", "esp": "724", "spain": "724",
  "ar": "032", "arg": "032", "argentina": "032",
  "ua": "804", "ukr": "804", "ukraine": "804",
  "sd": "729", "sdn": "729", "sudan": "729",
  "dz": "012", "dza": "012", "algeria": "012",
  "ug": "800", "uga": "800", "uganda": "800",
  "iq": "368", "irq": "368", "iraq": "368",
  "pl": "616", "pol": "616", "poland": "616",
  "ca": "124", "can": "124", "canada": "124",
  "ma": "504", "mar": "504", "morocco": "504",
  "sa": "682", "sau": "682", "saudi arabia": "682", "saudi arabia, kingdom of": "682",
  "uz": "860", "uzb": "860", "uzbekistan": "860",
  "my": "458", "mys": "458", "malaysia": "458",
  "pe": "604", "per": "604", "peru": "604",
  "af": "004", "afg": "004", "afghanistan": "004",
  "ao": "024", "ago": "024", "angola": "024",
  "gh": "288", "gha": "288", "ghana": "288",
  "ye": "887", "yem": "887", "yemen": "887",
  "mz": "508", "moz": "508", "mozambique": "508",
  "np": "524", "npl": "524", "nepal": "524",
  "ve": "862", "ven": "862", "venezuela": "862", "venezuela, bolivarian republic of": "862",
  "cm": "120", "cmr": "120", "cameroon": "120",
  "ci": "384", "civ": "384", "côte d'ivoire": "384", "cote d'ivoire": "384", "ivory coast": "384",
  "mg": "450", "mdg": "450", "madagascar": "450",
  "au": "036", "aus": "036", "australia": "036",
  "kp": "408", "prk": "408", "north korea": "408", "korea, democratic people's republic of": "408",
  "tw": "158", "twn": "158", "taiwan": "158", "taiwan, province of china": "158",
  "ne": "562", "ner": "562", "niger": "562",
  "lk": "144", "lka": "144", "sri lanka": "144",
  "bf": "854", "bfa": "854", "burkina faso": "854",
  "ml": "466", "mli": "466", "mali": "466",
  "ro": "642", "rou": "642", "romania": "642",
  "mw": "454", "mwi": "454", "malawi": "454",
  "cl": "152", "chl": "152", "chile": "152",
  "kz": "398", "kaz": "398", "kazakhstan": "398",
  "gt": "320", "gtm": "320", "guatemala": "320",
  "ec": "218", "ecu": "218", "ecuador": "218",
  "sy": "760", "syr": "760", "syria": "760", "syrian arab republic": "760",
  "kh": "116", "khm": "116", "cambodia": "116",
  "sn": "686", "sen": "686", "senegal": "686",
  "td": "148", "tcd": "148", "chad": "148",
  "so": "706", "som": "706", "somalia": "706",
  "zw": "716", "zwe": "716", "zimbabwe": "716",
  "gn": "324", "gin": "324", "guinea": "324",
  "rw": "646", "rwa": "646", "rwanda": "646",
  "bj": "204", "ben": "204", "benin": "204",
  "bi": "108", "bdi": "108", "burundi": "108",
  "tn": "788", "tun": "788", "tunisia": "788",
  "bo": "068", "bol": "068", "bolivia": "068", "bolivia, plurinational state of": "068",
  "be": "056", "bel": "056", "belgium": "056",
  "ht": "332", "hti": "332", "haiti": "332",
  "cu": "192", "cub": "192", "cuba": "192",
  "ss": "728", "ssd": "728", "south sudan": "728",
  "do": "214", "dom": "214", "dominican republic": "214",
  "cz": "203", "cze": "203", "czech republic": "203", "czechia": "203",
  "gr": "300", "grc": "300", "greece": "300",
  "jo": "400", "jor": "400", "jordan": "400",
  "pt": "620", "prt": "620", "portugal": "620",
  "az": "031", "aze": "031", "azerbaijan": "031",
  "se": "752", "swe": "752", "sweden": "752",
  "hn": "340", "hnd": "340", "honduras": "340",
  "ae": "784", "are": "784", "united arab emirates": "784", "uae": "784",
  "hu": "348", "hun": "348", "hungary": "348",
  "tj": "762", "tjk": "762", "tajikistan": "762",
  "by": "112", "blr": "112", "belarus": "112",
  "at": "040", "aut": "040", "austria": "040",
  "pg": "598", "png": "598", "papua new guinea": "598",
  "rs": "688", "srb": "688", "serbia": "688",
  "il": "376", "isr": "376", "israel": "376",
  "ch": "756", "che": "756", "switzerland": "756",
  "tg": "768", "tgo": "768", "togo": "768",
  "sl": "694", "sle": "694", "sierra leone": "694",
  "la": "418", "lao": "418", "lao people's democratic republic": "418", "laos": "418",
  "py": "600", "pry": "600", "paraguay": "600",
  "bg": "100", "bgr": "100", "bulgaria": "100",
  "lb": "422", "lbn": "422", "lebanon": "422",
  "ly": "434", "lby": "434", "libya": "434",
  "ni": "558", "nic": "558", "nicaragua": "558",
  "kg": "417", "kgz": "417", "kyrgyzstan": "417",
  "sv": "222", "slv": "222", "el salvador": "222",
  "tm": "795", "tkm": "795", "turkmenistan": "795",
  "sg": "702", "sgp": "702", "singapore": "702",
  "dk": "208", "dnk": "208", "denmark": "208",
  "fi": "246", "fin": "246", "finland": "246",
  "no": "578", "nor": "578", "norway": "578",
  "ie": "372", "irl": "372", "ireland": "372",
  "nz": "554", "nzl": "554", "new zealand": "554",
  "cr": "188", "cri": "188", "costa rica": "188",
  "om": "512", "omn": "512", "oman": "512",
  "lr": "430", "lbr": "430", "liberia": "430",
  "cf": "140", "caf": "140", "central african republic": "140",
  "pa": "591", "pan": "591", "panama": "591",
  "kw": "414", "kwt": "414", "kuwait": "414",
  "hr": "191", "hrv": "191", "croatia": "191",
  "md": "498", "mda": "498", "moldova": "498", "moldova, republic of": "498",
  "ge": "268", "geo": "268", "georgia": "268",
  "er": "232", "eri": "232", "eritrea": "232",
  "uy": "858", "ury": "858", "uruguay": "858",
  "ba": "070", "bih": "070", "bosnia and herzegovina": "070",
  "mn": "496", "mng": "496", "mongolia": "496",
  "am": "051", "arm": "051", "armenia": "051",
  "jm": "388", "jam": "388", "jamaica": "388",
  "qa": "634", "qat": "634", "qatar": "634",
  "al": "008", "alb": "008", "albania": "008",
  "lt": "440", "ltu": "440", "lithuania": "440",
  "na": "516", "nam": "516", "namibia": "516",
  "gm": "270", "gmb": "270", "gambia": "270",
  "bw": "072", "bwa": "072", "botswana": "072",
  "ga": "266", "gab": "266", "gabon": "266",
  "ls": "426", "lso": "426", "lesotho": "426",
  "mk": "807", "mkd": "807", "north macedonia": "807", "macedonia": "807",
  "si": "705", "svn": "705", "slovenia": "705",
  "gw": "624", "gnb": "624", "guinea-bissau": "624",
  "lv": "428", "lva": "428", "latvia": "428",
  "bh": "048", "bhr": "048", "bahrain": "048",
  "gq": "226", "gnq": "226", "equatorial guinea": "226",
  "tt": "780", "tto": "780", "trinidad and tobago": "780",
  "ee": "233", "est": "233", "estonia": "233",
  "tl": "626", "tls": "626", "timor-leste": "626", "east timor": "626",
  "mu": "480", "mus": "480", "mauritius": "480",
  "cy": "196", "cyp": "196", "cyprus": "196",
  "sz": "748", "swz": "748", "eswatini": "748", "swaziland": "748",
  "dj": "262", "dji": "262", "djibouti": "262",
  "fj": "242", "fji": "242", "fiji": "242",
  "km": "174", "com": "174", "comoros": "174",
  "gy": "328", "guy": "328", "guyana": "328",
  "bt": "064", "btn": "064", "bhutan": "064",
  "sb": "090", "slb": "090", "solomon islands": "090",
  "me": "499", "mne": "499", "montenegro": "499",
  "lu": "442", "lux": "442", "luxembourg": "442",
  "sr": "740", "sur": "740", "suriname": "740",
  "cv": "132", "cpv": "132", "cabo verde": "132", "cape verde": "132",
  "mv": "462", "mdv": "462", "maldives": "462",
  "mt": "470", "mlt": "470", "malta": "470",
  "bn": "096", "brn": "096", "brunei": "096", "brunei darussalam": "096",
  "bz": "084", "blz": "084", "belize": "084",
  "bs": "044", "bhs": "044", "bahamas": "044",
  "is": "352", "isl": "352", "iceland": "352",
  "vu": "548", "vut": "548", "vanuatu": "548",
  "bb": "052", "brb": "052", "barbados": "052",
  "st": "678", "stp": "678", "sao tome and principe": "678",
  "ws": "882", "wsm": "882", "samoa": "882",
  "lc": "662", "lca": "662", "saint lucia": "662",
  "ki": "296", "kir": "296", "kiribati": "296",
  "gd": "308", "grd": "308", "grenada": "308",
  "vc": "670", "vct": "670", "saint vincent and the grenadines": "670",
  "fm": "583", "fsm": "583", "micronesia, federated states of": "583", "micronesia": "583",
  "to": "776", "ton": "776", "tonga": "776",
  "sc": "690", "syc": "690", "seycchelles": "690",
  "ag": "028", "atg": "028", "antigua and barbuda": "028",
  "ad": "020", "and": "020", "andorra": "020",
  "dm": "212", "dma": "212", "dominica": "212",
  "kn": "659", "kna": "659", "saint kitts and nevis": "659",
  "mc": "492", "mco": "492", "monaco": "492",
  "li": "438", "lie": "438", "liechtenstein": "438",
  "sm": "674", "smr": "674", "san marino": "674",
  "pw": "585", "plw": "585", "palau": "585",
  "tv": "798", "tuv": "798", "tuvalu": "798",
  "nr": "520", "nru": "520", "nauru": "520",
  "mh": "584", "mhl": "584", "marshall islands": "584",
  "ck": "184", "cok": "184", "cook islands": "184",
  "nu": "570", "niu": "570", "niue": "570",
  "tk": "772", "tkl": "772", "tokelau": "772",
  "pf": "258", "pyf": "258", "french polynesia": "258",
  "nc": "540", "ncl": "540", "new caledonia": "540",
  "wf": "876", "wlf": "876", "wallis and futuna": "876",
  "pn": "612", "pcn": "612", "pitcairn": "612",
  "as": "016", "asm": "016", "american samoa": "016",
  "gu": "316", "gum": "316", "guam": "316",
  "mp": "580", "mnp": "580", "northern mariana islands": "580",
  "um": "581", "umi": "581", "united states minor outlying islands": "581",
  "vg": "092", "vgb": "092", "virgin islands, british": "092", "british virgin islands": "092",
  "vi": "850", "vir": "850", "virgin islands, u.s.": "850", "us virgin islands": "850",
  "ky": "136", "cym": "136", "cayman islands": "136",
  "bm": "060", "bmu": "060", "bermuda": "060",
  "gl": "304", "grl": "304", "greenland": "304",
  "fo": "234", "fro": "234", "faroe islands": "234",
  "ax": "248", "ala": "248", "åland islands": "248", "aland islands": "248",
  "sj": "744", "sjm": "744", "svalbard and jan mayen": "744",
  "bv": "074", "bvt": "074", "bouvet island": "074",
  "hm": "334", "hmd": "334", "heard island and mcdonald islands": "334",
  "gs": "239", "sgs": "239", "south georgia and the south sandwich islands": "239",
  "io": "086", "iot": "086", "british indian ocean territory": "086",
  "tf": "260", "atf": "260", "french southern territories": "260",
  "aq": "010", "ata": "010", "antarctica": "010",
  "cc": "166", "cck": "166", "cocos (keeling) islands": "166",
  "cx": "162", "cxr": "162", "christmas island": "162",
  "nf": "574", "nfk": "574", "norfolk island": "574",
  "yt": "175", "myt": "175", "mayotte": "175",
  "re": "638", "reu": "638", "réunion": "638", "reunion": "638",
  "gp": "312", "glp": "312", "guadeloupe": "312",
  "mq": "474", "mtq": "474", "martinique": "474",
  "bl": "652", "blm": "652", "saint barthélemy": "652", "saint barthelemy": "652",
  "mf": "663", "maf": "663", "saint martin (french part)": "663", "saint martin": "663",
  "sx": "534", "sxm": "534", "sint maarten (dutch part)": "534", "sint maarten": "534",
  "cw": "531", "cuw": "531", "curaçao": "531", "curacao": "531",
  "aw": "533", "abw": "533", "aruba": "533",
  "bq": "535", "bes": "535", "bonaire, sint eustatius and saba": "535", "caribbean netherlands": "535",
  "an": "530", "ant": "530", "netherlands antilles": "530",
  "pm": "666", "spm": "666", "saint pierre and miquelon": "666",
  "gg": "831", "ggy": "831", "guernsey": "831",
  "je": "832", "jey": "832", "jersey": "832",
  "im": "833", "imn": "833", "isle of man": "833",
  "gi": "292", "gib": "292", "gibraltar": "292",
  "va": "336", "vat": "336", "holy see": "336", "vatican": "336",
  "xk": "383", "xkx": "383", "kosovo": "383",
  "ps": "275", "pse": "275", "palestine, state of": "275", "palestine": "275",
  "eh": "732", "esh": "732", "western sahara": "732",
  "hk": "344", "hkg": "344", "hong kong": "344", "hong kong sar": "344",
  "mo": "446", "mac": "446", "macao": "446", "macau": "446",
};

let cachedWorld: WorldTopology | null = null;

async function loadWorld(): Promise<WorldTopology> {
  if (cachedWorld) return cachedWorld;
  try {
    const res = await fetch(WORLD_ATLAS_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    cachedWorld = (await res.json()) as WorldTopology;
    return cachedWorld;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load world atlas data -- check network connection: ${msg}`);
  }
}

export function registerLocatorGlobe(server: McpServer): void {
  server.tool(
    "locator_globe",
    "Generate an SVG locator globe centered on a lat/lon with an optional country highlight and label",
    {
      latitude: z.number().min(-90).max(90).describe("Center latitude"),
      longitude: z.number().min(-180).max(180).describe("Center longitude"),
      label: z.string().optional().describe("Label text near the point"),
      highlight_country_id: z
        .string()
        .optional()
        .describe("ISO 3166-1 numeric country code to highlight (e.g., '776' for Tonga)"),
      highlight_country: z
        .string()
        .optional()
        .describe("Country name, alpha-2 code (e.g., 'TO'), or alpha-3 code (e.g., 'TON'). Uses highlight_country_id if both provided."),
      size: z
        .number()
        .min(100)
        .max(2000)
        .default(500)
        .describe("SVG width/height in px"),
      output_path: z
        .string()
        .optional()
        .describe("File path to write SVG. If omitted, returns SVG string."),
      ocean_color: z.string().default("#e8f4f8").describe("Ocean fill color"),
      land_color: z.string().default("#d0d0d0").describe("Land fill color"),
      highlight_color: z
        .string()
        .default("#ffcccc")
        .describe("Highlighted country fill"),
      marker_color: z.string().default("#cc0000").describe("Point marker fill"),
      graticule: z
        .boolean()
        .default(true)
        .describe("Show graticule grid lines"),
    },
    async (params) => {
      // Resolve country code: highlight_country_id wins if both provided
      let resolvedCountryId: string | undefined = params.highlight_country_id;
      if (!resolvedCountryId && params.highlight_country) {
        const key = params.highlight_country.toLowerCase().trim();
        resolvedCountryId = COUNTRY_LOOKUP[key];
      }

      const world = await loadWorld();
      const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
      const document = dom.window.document;

      const { size, latitude, longitude } = params;

      const projection = d3
        .geoOrthographic()
        .scale(size * 0.48)
        .translate([size / 2, size / 2])
        .rotate([-longitude, -latitude])
        .clipAngle(90);

      const path = d3.geoPath(projection);

      const svg = d3
        .select(document.body)
        .append("svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("width", size)
        .attr("height", size)
        .attr("viewBox", `0 0 ${size} ${size}`);

      // Ocean
      svg
        .append("path")
        .datum({ type: "Sphere" } as unknown as GeoJSON.GeoJsonObject)
        .attr("d", path as any)
        .attr("fill", params.ocean_color)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 0.5);

      // Graticule
      if (params.graticule) {
        svg
          .append("path")
          .datum(d3.geoGraticule10())
          .attr("d", path as any)
          .attr("fill", "none")
          .attr("stroke", "#ddd")
          .attr("stroke-width", 0.3);
      }

      // Countries
      const countries = topojson.feature(
        world as any,
        world.objects.countries as any,
      ) as unknown as GeoJSON.FeatureCollection;

      svg
        .selectAll("path.country")
        .data(countries.features)
        .join("path")
        .attr("class", "country")
        .attr("d", (d: any) => path(d) || "")
        .attr("fill", (d: any) =>
          resolvedCountryId && d.id === resolvedCountryId
            ? params.highlight_color
            : params.land_color,
        )
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5);

      // Country borders
      const borders = topojson.mesh(
        world as any,
        world.objects.countries as any,
        (a: any, b: any) => a !== b,
      );
      svg
        .append("path")
        .datum(borders)
        .attr("d", path as any)
        .attr("fill", "none")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.3);

      // Point marker
      const projected = projection([longitude, latitude]);
      if (projected) {
        const [px, py] = projected;
        // Outer halo
        svg
          .append("circle")
          .attr("cx", px)
          .attr("cy", py)
          .attr("r", 8)
          .attr("fill", "none")
          .attr("stroke", params.marker_color)
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.4);
        // Inner dot
        svg
          .append("circle")
          .attr("cx", px)
          .attr("cy", py)
          .attr("r", 4)
          .attr("fill", params.marker_color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1);

        // Label
        if (params.label) {
          svg
            .append("text")
            .attr("x", px + 12)
            .attr("y", py + 5)
            .attr("font-family", "Helvetica, Arial, sans-serif")
            .attr("font-size", Math.max(12, size * 0.028))
            .attr("font-weight", "bold")
            .attr("fill", "#333")
            .text(params.label);
        }
      }

      const svgString = document.body.innerHTML;

      if (params.output_path) {
        writeFileSync(params.output_path, svgString);
        return {
          content: [
            {
              type: "text" as const,
              text: `SVG written to ${params.output_path}`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: svgString }],
      };
    },
  );
}
