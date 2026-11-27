/**
 * Curated quick-pick pairs for every platform pair and seed.
 *
 * Positive pairs are screened so that removing the attention-top M points lowers
 * the model score; C-removal is deliberately ignored. Negative pairs have a
 * sub-0.5 baseline that rises at a high mask ratio.
 */
export interface CuratedPair {
  user_a: number;
  user_b: number;
  note: string;
}

interface CuratedGroup {
  positive: CuratedPair[];
  negative: CuratedPair[];
}

const CURATED: Record<string, Record<string, CuratedGroup>> = {
  isp_wb_improved: {
    "454": {
      positive: [
        {
          user_a: 3169571,
          user_b: 3169571,
          note: 'base 0.9768 · M-removal 0.9475 (drop 0.0292)',
        },
        {
          user_a: 3368402,
          user_b: 3368402,
          note: 'base 0.629 · M-removal 0.4724 (drop 0.1566)',
        },
        {
          user_a: 3354167,
          user_b: 3354167,
          note: 'base 0.744 · M-removal 0.1054 (drop 0.6386)',
        },
        {
          user_a: 3383389,
          user_b: 3383389,
          note: 'base 0.7786 · M-removal 0.1175 (drop 0.661)',
        },
      ],
      negative: [
        {
          user_a: 3306021,
          user_b: 3440735,
          note: 'base 0.0473 · mask 0.9 = 0.1309',
        },
        {
          user_a: 3340449,
          user_b: 3280464,
          note: 'base 0.0185 · mask 0.9 = 0.9651',
        },
        {
          user_a: 3313040,
          user_b: 3220043,
          note: 'base 0.0142 · mask 0.9 = 0.1086',
        },
        {
          user_a: 3174642,
          user_b: 3103718,
          note: 'base 0.004 · mask 0.9 = 0.516',
        },
      ],
    },
    "512": {
      positive: [
        {
          user_a: 3301887,
          user_b: 3301887,
          note: 'base 0.9506 · M-removal 0.9437 (drop 0.0069)',
        },
        {
          user_a: 3212297,
          user_b: 3212297,
          note: 'base 0.646 · M-removal 0.3136 (drop 0.3324)',
        },
        {
          user_a: 3421869,
          user_b: 3421869,
          note: 'base 0.8271 · M-removal 0.3803 (drop 0.4469)',
        },
        {
          user_a: 3194054,
          user_b: 3194054,
          note: 'base 0.9324 · M-removal 0.8583 (drop 0.0741)',
        },
      ],
      negative: [
        {
          user_a: 3000309,
          user_b: 3282650,
          note: 'base 0.0675 · mask 0.9 = 0.8638',
        },
        {
          user_a: 3432655,
          user_b: 3042609,
          note: 'base 0.003 · mask 0.9 = 0.0335',
        },
        {
          user_a: 3465775,
          user_b: 3438067,
          note: 'base 0.419 · mask 0.9 = 0.4526',
        },
        {
          user_a: 3247418,
          user_b: 3104276,
          note: 'base 0.1265 · mask 0.9 = 0.6066',
        },
      ],
    },
    "631": {
      positive: [
        {
          user_a: 3468476,
          user_b: 3468476,
          note: 'base 0.6613 · M-removal 0.0006 (drop 0.6607)',
        },
        {
          user_a: 3289612,
          user_b: 3289612,
          note: 'base 0.8637 · M-removal 0.6943 (drop 0.1694)',
        },
        {
          user_a: 3025401,
          user_b: 3025401,
          note: 'base 0.6899 · M-removal 0.6811 (drop 0.0089)',
        },
        {
          user_a: 3194054,
          user_b: 3194054,
          note: 'base 0.9502 · M-removal 0.9095 (drop 0.0407)',
        },
      ],
      negative: [
        {
          user_a: 3048424,
          user_b: 3129467,
          note: 'base 0.0609 · mask 0.9 = 0.6413',
        },
        {
          user_a: 3088337,
          user_b: 3205851,
          note: 'base 0.398 · mask 0.9 = 0.8845',
        },
        {
          user_a: 3414524,
          user_b: 3340302,
          note: 'base 0.0609 · mask 0.9 = 0.1694',
        },
        {
          user_a: 3434428,
          user_b: 3051067,
          note: 'base 0.0039 · mask 0.9 = 0.0993',
        },
      ],
    },
    "812": {
      positive: [
        {
          user_a: 3085302,
          user_b: 3085302,
          note: 'base 0.8674 · M-removal 0.827 (drop 0.0404)',
        },
        {
          user_a: 3384276,
          user_b: 3384276,
          note: 'base 0.9558 · M-removal 0.759 (drop 0.1968)',
        },
        {
          user_a: 3104276,
          user_b: 3104276,
          note: 'base 0.8115 · M-removal 0.0253 (drop 0.7862)',
        },
        {
          user_a: 3387372,
          user_b: 3387372,
          note: 'base 0.944 · M-removal 0.9106 (drop 0.0334)',
        },
      ],
      negative: [
        {
          user_a: 3358362,
          user_b: 3166003,
          note: 'base 0.3339 · mask 0.9 = 0.5351',
        },
        {
          user_a: 3139594,
          user_b: 3387372,
          note: 'base 0.0443 · mask 0.9 = 0.2096',
        },
        {
          user_a: 3106289,
          user_b: 3367390,
          note: 'base 0.0071 · mask 0.9 = 0.0994',
        },
        {
          user_a: 3053953,
          user_b: 3318281,
          note: 'base 0.0623 · mask 0.9 = 0.3077',
        },
      ],
    },
    "932": {
      positive: [
        {
          user_a: 3096433,
          user_b: 3096433,
          note: 'base 0.9791 · M-removal 0.8947 (drop 0.0844)',
        },
        {
          user_a: 3437138,
          user_b: 3437138,
          note: 'base 0.9142 · M-removal 0.5473 (drop 0.3669)',
        },
        {
          user_a: 3440735,
          user_b: 3440735,
          note: 'base 0.8485 · M-removal 0.3477 (drop 0.5008)',
        },
        {
          user_a: 3317462,
          user_b: 3317462,
          note: 'base 0.9355 · M-removal 0.8785 (drop 0.057)',
        },
      ],
      negative: [
        {
          user_a: 3061383,
          user_b: 3376875,
          note: 'base 0.1473 · mask 0.9 = 0.8093',
        },
        {
          user_a: 3113938,
          user_b: 3311740,
          note: 'base 0.0561 · mask 0.9 = 0.1832',
        },
        {
          user_a: 3036225,
          user_b: 3126011,
          note: 'base 0.0044 · mask 0.9 = 0.3902',
        },
        {
          user_a: 3185272,
          user_b: 3031785,
          note: 'base 0.0031 · mask 0.9 = 0.0706',
        },
      ],
    },
  },
  tw_fs_improved: {
    "454": {
      positive: [
        {
          user_a: 33762,
          user_b: 33762,
          note: 'base 0.8445 · M-removal 0.799 (drop 0.0455)',
        },
        {
          user_a: 43633,
          user_b: 43633,
          note: 'base 0.664 · M-removal 0.6219 (drop 0.0421)',
        },
        {
          user_a: 21318,
          user_b: 21318,
          note: 'base 0.7356 · M-removal 0.2987 (drop 0.4369)',
        },
        {
          user_a: 38836,
          user_b: 38836,
          note: 'base 0.9554 · M-removal 0.8665 (drop 0.0889)',
        },
      ],
      negative: [
        {
          user_a: 50762,
          user_b: 45927,
          note: 'base 0.0877 · mask 0.9 = 0.8617',
        },
        {
          user_a: 36077,
          user_b: 785,
          note: 'base 0.1172 · mask 0.9 = 0.7803',
        },
        {
          user_a: 52110,
          user_b: 1008,
          note: 'base 0.3847 · mask 0.9 = 0.5103',
        },
        {
          user_a: 48313,
          user_b: 15484,
          note: 'base 0.1947 · mask 0.9 = 0.7717',
        },
      ],
    },
    "512": {
      positive: [
        {
          user_a: 34227,
          user_b: 34227,
          note: 'base 0.7114 · M-removal 0.6902 (drop 0.0212)',
        },
        {
          user_a: 54660,
          user_b: 54660,
          note: 'base 0.657 · M-removal 0.2189 (drop 0.4381)',
        },
        {
          user_a: 29645,
          user_b: 29645,
          note: 'base 0.8143 · M-removal 0.7762 (drop 0.0381)',
        },
        {
          user_a: 58890,
          user_b: 58890,
          note: 'base 0.7427 · M-removal 0.2242 (drop 0.5184)',
        },
      ],
      negative: [
        {
          user_a: 16122,
          user_b: 112,
          note: 'base 0.2328 · mask 0.9 = 0.7901',
        },
        {
          user_a: 36757,
          user_b: 254,
          note: 'base 0.0345 · mask 0.9 = 0.787',
        },
        {
          user_a: 56874,
          user_b: 42815,
          note: 'base 0.1011 · mask 0.9 = 0.5317',
        },
        {
          user_a: 41869,
          user_b: 18096,
          note: 'base 0.4075 · mask 0.9 = 0.735',
        },
      ],
    },
    "631": {
      positive: [
        {
          user_a: 47726,
          user_b: 47726,
          note: 'base 0.588 · M-removal 0.4873 (drop 0.1008)',
        },
        {
          user_a: 29700,
          user_b: 29700,
          note: 'base 0.748 · M-removal 0.2018 (drop 0.5462)',
        },
        {
          user_a: 37171,
          user_b: 37171,
          note: 'base 0.6971 · M-removal 0.5447 (drop 0.1523)',
        },
        {
          user_a: 27284,
          user_b: 27284,
          note: 'base 0.7748 · M-removal 0.7676 (drop 0.0072)',
        },
      ],
      negative: [
        {
          user_a: 40291,
          user_b: 63020,
          note: 'base 0.0736 · mask 0.9 = 0.7142',
        },
        {
          user_a: 32908,
          user_b: 47726,
          note: 'base 0.1534 · mask 0.9 = 0.4541',
        },
        {
          user_a: 18338,
          user_b: 41208,
          note: 'base 0.0917 · mask 0.9 = 0.4763',
        },
        {
          user_a: 39,
          user_b: 43916,
          note: 'base 0.0815 · mask 0.9 = 0.1329',
        },
      ],
    },
    "812": {
      positive: [
        {
          user_a: 59724,
          user_b: 59724,
          note: 'base 0.8224 · M-removal 0.6573 (drop 0.1652)',
        },
        {
          user_a: 4304,
          user_b: 4304,
          note: 'base 0.8098 · M-removal 0.7983 (drop 0.0115)',
        },
        {
          user_a: 51878,
          user_b: 51878,
          note: 'base 0.6995 · M-removal 0.6749 (drop 0.0246)',
        },
        {
          user_a: 42231,
          user_b: 42231,
          note: 'base 0.713 · M-removal 0.4204 (drop 0.2925)',
        },
      ],
      negative: [
        {
          user_a: 53370,
          user_b: 62674,
          note: 'base 0.3393 · mask 0.9 = 0.7132',
        },
        {
          user_a: 49655,
          user_b: 50048,
          note: 'base 0.1087 · mask 0.9 = 0.1773',
        },
        {
          user_a: 14581,
          user_b: 2024,
          note: 'base 0.0599 · mask 0.9 = 0.1132',
        },
        {
          user_a: 26064,
          user_b: 44394,
          note: 'base 0.4851 · mask 0.9 = 0.8833',
        },
      ],
    },
    "932": {
      positive: [
        {
          user_a: 37684,
          user_b: 37684,
          note: 'base 0.8702 · M-removal 0.427 (drop 0.4432)',
        },
        {
          user_a: 49998,
          user_b: 49998,
          note: 'base 0.8114 · M-removal 0.4965 (drop 0.315)',
        },
        {
          user_a: 42841,
          user_b: 42841,
          note: 'base 0.8639 · M-removal 0.8332 (drop 0.0306)',
        },
        {
          user_a: 67303,
          user_b: 67303,
          note: 'base 0.8547 · M-removal 0.7915 (drop 0.0632)',
        },
      ],
      negative: [
        {
          user_a: 70128,
          user_b: 60053,
          note: 'base 0.0283 · mask 0.9 = 0.3262',
        },
        {
          user_a: 45525,
          user_b: 25704,
          note: 'base 0.0809 · mask 0.9 = 0.8469',
        },
        {
          user_a: 38836,
          user_b: 10118,
          note: 'base 0.0074 · mask 0.9 = 0.5681',
        },
        {
          user_a: 75627,
          user_b: 18770,
          note: 'base 0.3613 · mask 0.9 = 0.696',
        },
      ],
    },
  },
  tw_fb_improved: {
    "454": {
      positive: [
        {
          user_a: 24405,
          user_b: 24405,
          note: 'base 0.9273 · M-removal 0.9114 (drop 0.0159)',
        },
        {
          user_a: 14760,
          user_b: 14760,
          note: 'base 0.9547 · M-removal 0.9399 (drop 0.0149)',
        },
        {
          user_a: 43833,
          user_b: 43833,
          note: 'base 0.9656 · M-removal 0.8803 (drop 0.0853)',
        },
        {
          user_a: 3588,
          user_b: 3588,
          note: 'base 0.7507 · M-removal 0.708 (drop 0.0427)',
        },
      ],
      negative: [
        {
          user_a: 37632,
          user_b: 56001,
          note: 'base 0.0778 · mask 0.9 = 0.9047',
        },
        {
          user_a: 17505,
          user_b: 52383,
          note: 'base 0.0064 · mask 0.9 = 0.2689',
        },
        {
          user_a: 57216,
          user_b: 45423,
          note: 'base 0.0975 · mask 0.9 = 0.9252',
        },
        {
          user_a: 2245,
          user_b: 41880,
          note: 'base 0.0016 · mask 0.9 = 0.9059',
        },
      ],
    },
    "512": {
      positive: [
        {
          user_a: 51761,
          user_b: 51761,
          note: 'base 0.6894 · M-removal 0.1465 (drop 0.5429)',
        },
        {
          user_a: 73003,
          user_b: 73003,
          note: 'base 0.6038 · M-removal 0.4368 (drop 0.1671)',
        },
        {
          user_a: 23839,
          user_b: 23839,
          note: 'base 0.7994 · M-removal 0.7142 (drop 0.0852)',
        },
        {
          user_a: 72238,
          user_b: 72238,
          note: 'base 0.7283 · M-removal 0.612 (drop 0.1163)',
        },
      ],
      negative: [
        {
          user_a: 62097,
          user_b: 21942,
          note: 'base 0.1253 · mask 0.9 = 0.798',
        },
        {
          user_a: 1498,
          user_b: 29862,
          note: 'base 0.0365 · mask 0.9 = 0.9072',
        },
        {
          user_a: 252,
          user_b: 2439,
          note: 'base 0.0672 · mask 0.9 = 0.9114',
        },
        {
          user_a: 4042,
          user_b: 76346,
          note: 'base 0.3729 · mask 0.9 = 0.8776',
        },
      ],
    },
    "631": {
      positive: [
        {
          user_a: 57719,
          user_b: 57719,
          note: 'base 0.8604 · M-removal 0.5677 (drop 0.2926)',
        },
        {
          user_a: 16213,
          user_b: 16213,
          note: 'base 0.9024 · M-removal 0.8611 (drop 0.0413)',
        },
        {
          user_a: 58842,
          user_b: 58842,
          note: 'base 0.8008 · M-removal 0.6891 (drop 0.1117)',
        },
        {
          user_a: 55977,
          user_b: 55977,
          note: 'base 0.8946 · M-removal 0.8866 (drop 0.008)',
        },
      ],
      negative: [
        {
          user_a: 52348,
          user_b: 30047,
          note: 'base 0.0022 · mask 0.9 = 0.6847',
        },
        {
          user_a: 44986,
          user_b: 38019,
          note: 'base 0.4207 · mask 0.9 = 0.9188',
        },
        {
          user_a: 15036,
          user_b: 47103,
          note: 'base 0.004 · mask 0.9 = 0.4241',
        },
        {
          user_a: 45216,
          user_b: 39760,
          note: 'base 0.1531 · mask 0.9 = 0.891',
        },
      ],
    },
    "812": {
      positive: [
        {
          user_a: 56278,
          user_b: 56278,
          note: 'base 0.9222 · M-removal 0.911 (drop 0.0112)',
        },
        {
          user_a: 28736,
          user_b: 28736,
          note: 'base 0.7493 · M-removal 0.497 (drop 0.2523)',
        },
        {
          user_a: 45191,
          user_b: 45191,
          note: 'base 0.8973 · M-removal 0.8917 (drop 0.0056)',
        },
        {
          user_a: 55360,
          user_b: 55360,
          note: 'base 0.8351 · M-removal 0.685 (drop 0.1502)',
        },
      ],
      negative: [
        {
          user_a: 24640,
          user_b: 60379,
          note: 'base 0.0011 · mask 0.9 = 0.7303',
        },
        {
          user_a: 38854,
          user_b: 2564,
          note: 'base 0.143 · mask 0.9 = 0.8903',
        },
        {
          user_a: 14239,
          user_b: 17477,
          note: 'base 0.1201 · mask 0.9 = 0.8326',
        },
        {
          user_a: 59501,
          user_b: 59712,
          note: 'base 0.3363 · mask 0.9 = 0.577',
        },
      ],
    },
    "932": {
      positive: [
        {
          user_a: 34481,
          user_b: 34481,
          note: 'base 0.616 · M-removal 0.2783 (drop 0.3377)',
        },
        {
          user_a: 63959,
          user_b: 63959,
          note: 'base 0.822 · M-removal 0.2271 (drop 0.5949)',
        },
        {
          user_a: 73199,
          user_b: 73199,
          note: 'base 0.9499 · M-removal 0.9386 (drop 0.0113)',
        },
        {
          user_a: 30737,
          user_b: 30737,
          note: 'base 0.6056 · M-removal 0.0748 (drop 0.5308)',
        },
      ],
      negative: [
        {
          user_a: 74263,
          user_b: 37415,
          note: 'base 0.0153 · mask 0.9 = 0.5993',
        },
        {
          user_a: 23334,
          user_b: 24947,
          note: 'base 0.0186 · mask 0.9 = 0.9012',
        },
        {
          user_a: 37986,
          user_b: 26650,
          note: 'base 0.0014 · mask 0.9 = 0.0893',
        },
        {
          user_a: 22046,
          user_b: 30415,
          note: 'base 0.0585 · mask 0.9 = 0.3904',
        },
      ],
    },
  },
  fs_fb_improved: {
    "454": {
      positive: [
        {
          user_a: 27585,
          user_b: 27585,
          note: 'base 0.5737 · M-removal 0.2663 (drop 0.3074)',
        },
        {
          user_a: 41568,
          user_b: 41568,
          note: 'base 0.7446 · M-removal 0.6749 (drop 0.0698)',
        },
        {
          user_a: 756,
          user_b: 756,
          note: 'base 0.8967 · M-removal 0.4916 (drop 0.4051)',
        },
        {
          user_a: 43830,
          user_b: 43830,
          note: 'base 0.5994 · M-removal 0.2564 (drop 0.343)',
        },
      ],
      negative: [
        {
          user_a: 20385,
          user_b: 756,
          note: 'base 0.119 · mask 0.9 = 0.4482',
        },
        {
          user_a: 68050,
          user_b: 19876,
          note: 'base 0.1325 · mask 0.9 = 0.3115',
        },
        {
          user_a: 52965,
          user_b: 3113,
          note: 'base 0.0958 · mask 0.9 = 0.6812',
        },
        {
          user_a: 24102,
          user_b: 55126,
          note: 'base 0.114 · mask 0.9 = 0.4278',
        },
      ],
    },
    "512": {
      positive: [
        {
          user_a: 45740,
          user_b: 45740,
          note: 'base 0.7486 · M-removal 0.0071 (drop 0.7415)',
        },
        {
          user_a: 59562,
          user_b: 59562,
          note: 'base 0.8044 · M-removal 0.4595 (drop 0.3449)',
        },
        {
          user_a: 59011,
          user_b: 59011,
          note: 'base 0.9304 · M-removal 0.8769 (drop 0.0535)',
        },
        {
          user_a: 17362,
          user_b: 17362,
          note: 'base 0.6395 · M-removal 0.0031 (drop 0.6364)',
        },
      ],
      negative: [
        {
          user_a: 43044,
          user_b: 33167,
          note: 'base 0.0643 · mask 0.9 = 0.8221',
        },
        {
          user_a: 49577,
          user_b: 14757,
          note: 'base 0.0445 · mask 0.9 = 0.7402',
        },
        {
          user_a: 13006,
          user_b: 28978,
          note: 'base 0.1546 · mask 0.9 = 0.8719',
        },
        {
          user_a: 19861,
          user_b: 57509,
          note: 'base 0.1228 · mask 0.9 = 0.8364',
        },
      ],
    },
    "631": {
      positive: [
        {
          user_a: 43664,
          user_b: 43664,
          note: 'base 0.8584 · M-removal 0.7899 (drop 0.0686)',
        },
        {
          user_a: 64539,
          user_b: 64539,
          note: 'base 0.7532 · M-removal 0.2198 (drop 0.5335)',
        },
        {
          user_a: 33625,
          user_b: 33625,
          note: 'base 0.7184 · M-removal 0.7017 (drop 0.0167)',
        },
        {
          user_a: 738,
          user_b: 738,
          note: 'base 0.8709 · M-removal 0.8517 (drop 0.0192)',
        },
      ],
      negative: [
        {
          user_a: 35773,
          user_b: 61575,
          note: 'base 0.033 · mask 0.9 = 0.6833',
        },
        {
          user_a: 37935,
          user_b: 14341,
          note: 'base 0.0171 · mask 0.9 = 0.3373',
        },
        {
          user_a: 13643,
          user_b: 30663,
          note: 'base 0.0986 · mask 0.9 = 0.2008',
        },
        {
          user_a: 53,
          user_b: 19945,
          note: 'base 0.2683 · mask 0.9 = 0.723',
        },
      ],
    },
    "812": {
      positive: [
        {
          user_a: 2417,
          user_b: 2417,
          note: 'base 0.9077 · M-removal 0.7632 (drop 0.1446)',
        },
        {
          user_a: 23852,
          user_b: 23852,
          note: 'base 0.9248 · M-removal 0.8799 (drop 0.0449)',
        },
        {
          user_a: 57898,
          user_b: 57898,
          note: 'base 0.7555 · M-removal 0.638 (drop 0.1175)',
        },
        {
          user_a: 46796,
          user_b: 46796,
          note: 'base 0.9484 · M-removal 0.7345 (drop 0.214)',
        },
      ],
      negative: [
        {
          user_a: 4748,
          user_b: 37755,
          note: 'base 0.0058 · mask 0.9 = 0.9564',
        },
        {
          user_a: 46528,
          user_b: 20742,
          note: 'base 0.3276 · mask 0.9 = 0.9468',
        },
        {
          user_a: 5698,
          user_b: 50877,
          note: 'base 0.4657 · mask 0.9 = 0.5682',
        },
        {
          user_a: 15938,
          user_b: 48724,
          note: 'base 0.4817 · mask 0.9 = 0.8183',
        },
      ],
    },
    "932": {
      positive: [
        {
          user_a: 45935,
          user_b: 45935,
          note: 'base 0.5786 · M-removal 0.5598 (drop 0.0189)',
        },
        {
          user_a: 45513,
          user_b: 45513,
          note: 'base 0.7265 · M-removal 0.6946 (drop 0.0319)',
        },
        {
          user_a: 33105,
          user_b: 33105,
          note: 'base 0.5645 · M-removal 0.538 (drop 0.0265)',
        },
        {
          user_a: 40733,
          user_b: 40733,
          note: 'base 0.6394 · M-removal 0.131 (drop 0.5084)',
        },
      ],
      negative: [
        {
          user_a: 69848,
          user_b: 44901,
          note: 'base 0.303 · mask 0.9 = 0.7638',
        },
        {
          user_a: 70093,
          user_b: 3195,
          note: 'base 0.0619 · mask 0.9 = 0.5322',
        },
        {
          user_a: 27692,
          user_b: 19972,
          note: 'base 0.1823 · mask 0.9 = 0.7254',
        },
        {
          user_a: 18402,
          user_b: 19293,
          note: 'base 0.111 · mask 0.9 = 0.7688',
        },
      ],
    },
  },
};

const EMPTY: CuratedGroup = { positive: [], negative: [] };

export function curatedFor(comboId: string, seed: string): CuratedGroup {
  return CURATED[comboId]?.[seed] ?? EMPTY;
}
