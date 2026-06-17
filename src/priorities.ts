import type { PriorityRegion } from "./types";

export const priorityRegions: PriorityRegion[] = [
  {
    id: "mazowieckie",
    label: "Mazowieckie",
    center: [52.17, 21.05],
    zoom: 7.35,
    polygon: "M538 318 C598 285 692 286 763 354 C790 425 752 510 674 562 C599 574 528 538 482 476 C455 405 475 354 538 318 Z",
    reason: "Warsaw-Radom corridor: events are hot, sales trail is strong, debt pressure is visible."
  },
  {
    id: "wielkopolskie",
    label: "Wielkopolskie",
    center: [52.34, 16.95],
    zoom: 7.25,
    polygon: "M172 282 C218 214 282 183 344 188 C430 221 497 282 508 348 C486 421 414 486 322 496 C240 478 166 426 120 364 C124 330 142 302 172 282 Z",
    reason: "Western logistics corridor: population is solid, stock signals need a field check."
  },
  {
    id: "slaskie",
    label: "Slaskie",
    center: [50.25, 19.05],
    zoom: 7.45,
    polygon: "M292 580 C382 618 474 646 558 632 C590 660 590 700 548 735 C438 737 330 712 244 660 C246 620 266 594 292 580 Z",
    reason: "Dense southern market: sales are good, but debt and stock pressure make it a priority."
  },
  {
    id: "malopolskie",
    label: "Malopolskie",
    center: [49.95, 20.05],
    zoom: 7.45,
    polygon: "M558 632 C604 592 650 578 710 586 C756 592 792 604 808 616 C750 684 656 730 548 735 C590 700 590 660 558 632 Z",
    reason: "Event forecast and southern route density suggest a short activation run."
  },
  {
    id: "pomorskie",
    label: "Pomorskie",
    center: [54.18, 18.45],
    zoom: 7.1,
    polygon: "M330 98 C420 52 562 60 674 104 C678 156 644 206 576 232 C486 256 394 224 314 170 C304 140 310 116 330 98 Z",
    reason: "Northern event ring: lower debt, but forecasted demand makes it worth sampling."
  },
  {
    id: "lodzkie",
    label: "Lodzkie",
    center: [51.77, 19.48],
    zoom: 7.55,
    polygon: "M326 490 C420 472 482 438 538 504 C574 548 594 592 564 638 C474 652 380 630 296 580 C286 542 298 512 326 490 Z",
    reason: "Central warehouse pressure: stock overflow is the reason to send ops and sales together."
  }
];
