# SevaAI Manipur Demonstration Data

## Purpose and status

`raw/sevaai_demo_data.csv` is a village-level example dataset for developing and demonstrating the SevaAI Manipur data workflow. It contains records across Manipur's 16 district names and represents a single reporting date with previous-period service coverage for trend comparisons.

**All service and beneficiary-related values in this dataset are synthetic and are intended only for demonstration and hackathon development.**

The values are not official government statistics, programme records, survey results, beneficiary counts, or evidence about a real village. Village names, local-council groupings, identifiers, and point coordinates are generated for demonstration. District and block labels are plausible prototype geography, not a verified authoritative boundary register. The dataset is not connected to PM-JAY, PMAY-G, Jal Jeevan Mission, or any government database.

## Generation and reproducibility

Run `python data/generate_dataset.py` from the repository root to regenerate the 2,000-row CSV. The generator uses only the Python standard library and a fixed random seed so its output is repeatable. It distributes all scenario types across districts rather than assigning one pattern to an entire district.

Scenario patterns include generally high coverage, a low-coverage service, simultaneous service gaps, higher pending burden, declining historical coverage, an unusual combination of otherwise stronger and weaker services, medium coverage, and normal variation. These are synthetic test patterns for future analytics; they are not classifications of actual places.

Run `python data/validate_dataset.py` to check the output. The raw-data ignore policy normally excludes local source datasets but explicitly permits this named synthetic demonstration CSV to be versioned.

## Geography and coordinates

The hierarchy is `state → district → block → gram_panchayat → village`. A district's block labels are reused consistently within that district; each generated village is assigned one stable parent block and local-council grouping.

`gram_panchayat` is retained as the requested interchange field. Its values are generated **local-council grouping labels**, not official Gram Panchayat names. Administrative structures and terminology vary across Manipur, particularly in hill areas, so this field must not be treated as an authoritative governance-unit register.

Coordinates are synthetic points jittered around approximate district reference locations to support map prototyping. They are not surveyed village centroids, official settlement locations, boundaries, or navigation coordinates. Do not use them for field operations or policy decisions.

## Columns

| Column | Meaning |
| --- | --- |
| `village_id` | Unique synthetic internal identifier for this demonstration village. |
| `state` | State label; all records use `Manipur`. |
| `district` | Plausible district label used to group prototype records; not a verified administrative master list. |
| `block` | Plausible block label assigned under its district for consistent grouping. |
| `gram_panchayat` | Synthetic local-council grouping label used as the requested hierarchy level; not an official GP name. |
| `village` | Generated demonstration village label; not a claim that the named settlement exists. |
| `population` | Synthetic total population count for the demonstration village. |
| `households` | Synthetic total household count; generated so households do not exceed population. |
| `eligible_households` | Synthetic eligible-household denominator for the overall pending-rate calculation; no service entitlement is implied. |
| `housing_eligible` | Synthetic household denominator for the housing coverage measure. |
| `housing_covered` | Synthetic number covered in the housing measure; never greater than `housing_eligible`. |
| `housing_coverage` | Housing coverage percentage derived from covered divided by eligible. |
| `health_eligible` | Synthetic household denominator for the health coverage measure. |
| `health_covered` | Synthetic number covered in the health measure; never greater than `health_eligible`. |
| `health_coverage` | Health coverage percentage derived from covered divided by eligible. |
| `water_eligible` | Synthetic household denominator for the water coverage measure. |
| `water_covered` | Synthetic number covered in the water measure; never greater than `water_eligible`. |
| `water_coverage` | Water coverage percentage derived from covered divided by eligible. |
| `welfare_eligible` | Synthetic household denominator for the welfare coverage measure. |
| `welfare_covered` | Synthetic number covered in the welfare measure; never greater than `welfare_eligible`. |
| `welfare_coverage` | Welfare coverage percentage derived from covered divided by eligible. |
| `pending_cases` | Synthetic aggregate count of pending cases; it does not identify individual cases or beneficiaries. |
| `pending_rate` | Pending cases as a percentage of `eligible_households`. |
| `historical_water_coverage` | Synthetic previous-period water coverage percentage for trend comparison. |
| `historical_health_coverage` | Synthetic previous-period health coverage percentage for trend comparison. |
| `historical_housing_coverage` | Synthetic previous-period housing coverage percentage for trend comparison. |
| `historical_welfare_coverage` | Synthetic previous-period welfare coverage percentage for trend comparison. |
| `latitude` | Synthetic approximate point coordinate near a district reference location; not an official village centroid. |
| `longitude` | Synthetic approximate point coordinate near a district reference location; not an official village centroid. |
| `data_date` | ISO-format reporting date represented by the current-period measures (`2025-03-31`). |

## Calculation rules

For each service:

**Coverage = covered / eligible × 100**

The exported percentage is rounded to two decimal places using decimal `ROUND_HALF_UP` rounding, matching PostgreSQL `NUMERIC` rounding. The generator and validator use the same exact Decimal-based calculation. Covered values do not exceed eligible values, so each coverage value is in the range 0–100. Service-specific denominators are separate because eligibility may differ between services.

**Pending rate = pending_cases / eligible_households × 100**

This dataset uses the overall `eligible_households` denominator consistently for `pending_rate`; it is a synthetic aggregate, not a scheme-specific caseload measure. It is rounded to two decimal places using decimal `ROUND_HALF_UP`, matching PostgreSQL `NUMERIC` rounding.

The `historical_*_coverage` values represent one synthetic prior period. Comparing current service coverage with its corresponding historical field gives a simple direction/magnitude of change; this file does not provide a complete time series. A higher prior value than current indicates a synthetic negative trend. Historical values are scenario-generated and are not observed history.

## Intended future use

The dataset is designed to support later work on:

- deterministic coverage and gap calculations
- multi-service priority scoring experiments
- village, block, and district filtering
- map prototypes using the synthetic point coordinates
- historical trend comparisons
- testing anomaly-detection pipelines against deliberately varied synthetic patterns
- demonstrating intervention workflows without real case or beneficiary records

An unusual or low-coverage pattern is only a demonstration signal. If future anomaly detection is used, an anomaly means an unusual pattern requiring investigation; it is not fraud detection or proof of wrongdoing. Any AI output is decision support and must not automatically approve or reject benefits.

## Privacy and production data

This CSV contains no beneficiary names, Aadhaar numbers, phone numbers, personal addresses, or other direct beneficiary identifiers. Do not add personally identifiable beneficiary information to the prototype.

Production deployment would require authorized government data sources, such as approved APIs, exports, or secure feeds under an appropriate data-sharing basis. It would also require source provenance, validated administrative geography, privacy and security review, access controls, retention rules, and domain-owner review. This synthetic file is not a substitute for, nor evidence of access to, government systems or official statistics.
