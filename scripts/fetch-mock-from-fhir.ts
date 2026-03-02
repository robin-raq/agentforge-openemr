#!/usr/bin/env npx tsx
/**
 * Fetch patients from OpenEMR FHIR API and add them to mock-data.json.
 *
 * Prerequisites:
 * - DATA_SOURCE=fhir in .env (or script uses FHIR_* vars directly)
 * - OpenEMR Docker running with FHIR API
 * - FHIR_BASE_URL, FHIR_CLIENT_ID, FHIR_USERNAME, FHIR_PASSWORD in .env
 *
 * Usage:
 *   npx tsx scripts/fetch-mock-from-fhir.ts [--limit N] [--append]
 *
 * Options:
 *   --limit N   Max patients to fetch (default: 20)
 *   --append    Add to existing mock data (default: merge, keeping patients 1-4)
 *   --replace   Replace mock data entirely (removes patients 1-4)
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { FhirDataSource } from "../src/data/fhir-datasource";
import type {
  PatientData,
  MedicationData,
  LabResult,
  EncounterData,
  AdmissionMedication,
  Appointment,
} from "../src/data/datasource";

function deriveFhirUrls(baseUrl: string) {
  const url = new URL(baseUrl);
  const origin = url.origin;
  const pathParts = url.pathname.replace(/\/$/, "").split("/");
  const fhirIndex = pathParts.indexOf("fhir");
  const basePath =
    fhirIndex >= 0 ? pathParts.slice(0, fhirIndex).join("/") : "/apis/default";
  const apiPath = basePath.replace(/\/fhir$/, "") + "/api";
  return {
    fhirBaseUrl: baseUrl.replace(/\/$/, ""),
    apiBaseUrl: `${origin}${apiPath}`,
    tokenUrl: `${origin}/oauth2/default/token`,
  };
}

async function fetchPatientIds(fhir: FhirDataSource, limit: number): Promise<string[]> {
  const patients = await fhir.listPatients();
  return patients.slice(0, limit).map((p) => p.id);
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 && args[limitIdx + 1]
    ? parseInt(args[limitIdx + 1], 10)
    : 20;
  const replace = args.includes("--replace");

  const baseUrl = process.env.FHIR_BASE_URL;
  const clientId = process.env.FHIR_CLIENT_ID;
  const username = process.env.FHIR_USERNAME;
  const password = process.env.FHIR_PASSWORD;

  if (!baseUrl || !clientId || !username || !password) {
    console.error("Missing FHIR config. Set FHIR_BASE_URL, FHIR_CLIENT_ID, FHIR_USERNAME, FHIR_PASSWORD in .env");
    process.exit(1);
  }

  const { fhirBaseUrl, apiBaseUrl, tokenUrl } = deriveFhirUrls(baseUrl);
  const fhir = new FhirDataSource({
    fhirBaseUrl,
    apiBaseUrl,
    tokenUrl,
    clientId,
    clientSecret: process.env.FHIR_CLIENT_SECRET,
    username,
    password,
    scope: process.env.FHIR_SCOPE,
  });

  console.log("Fetching patient list from FHIR...");
  const uuids = await fetchPatientIds(fhir, limit);
  console.log(`Found ${uuids.length} patients`);

  if (uuids.length === 0) {
    console.log("No patients to add.");
    return;
  }

  const mockPath = path.join(__dirname, "../src/data/mock-data.json");
  let existing: Record<string, unknown> = {};
  if (!replace && fs.existsSync(mockPath)) {
    existing = JSON.parse(fs.readFileSync(mockPath, "utf-8")) as Record<string, unknown>;
  }

  const patients: Record<string, PatientData> = replace
    ? {}
    : ((existing.patients as Record<string, PatientData>) ?? {});
  const medications: Record<string, MedicationData[]> = replace
    ? {}
    : ((existing.medications as Record<string, MedicationData[]>) ?? {});
  const lab_results: Record<string, LabResult[]> = replace
    ? {}
    : ((existing.lab_results as Record<string, LabResult[]>) ?? {});
  const encounters: Record<string, EncounterData[]> = replace
    ? {}
    : ((existing.encounters as Record<string, EncounterData[]>) ?? {});
  const admission_medications: Record<string, AdmissionMedication[]> = replace
    ? {}
    : ((existing.admission_medications as Record<string, AdmissionMedication[]>) ?? {});
  const appointments: Record<string, Appointment[]> = replace
    ? {}
    : ((existing.appointments as Record<string, Appointment[]>) ?? {});
  const documents = replace ? {} : ((existing.documents as Record<string, unknown>) ?? {});

  const existingIds = new Set(Object.keys(patients));
  let nextId = 1;
  while (existingIds.has(String(nextId))) nextId++;

  for (const uuid of uuids) {
    const newId = String(nextId);
    if (existingIds.has(newId)) {
      nextId++;
      continue;
    }

    try {
      console.log(`  Fetching patient ${uuid} -> ID ${newId}...`);
      const patient = await fhir.getPatient(uuid);
      const meds = await fhir.getMedications(uuid);
      const labs = await fhir.getLabResults(uuid);
      const encs = await fhir.getEncounters(uuid);
      const appts = await fhir.getAppointments(uuid);

      const patientData: PatientData = {
        ...patient,
        patient_id: newId,
      };
      patients[newId] = patientData;
      medications[newId] = meds;
      lab_results[newId] = labs;
      encounters[newId] = encs.map((e) => ({ ...e, patient_id: newId }));
      appointments[newId] = appts.map((a) => ({ ...a, patient_id: newId }));

      for (const enc of encs) {
        try {
          const admMeds = await fhir.getAdmissionMedications(enc.encounter_id);
          admission_medications[enc.encounter_id] = admMeds;
        } catch {
          // Encounter may not have admission meds
        }
      }

      existingIds.add(newId);
      nextId++;
    } catch (err) {
      console.warn(`  Skipped ${uuid}:`, (err as Error).message);
    }
  }

  const output = {
    patients,
    medications,
    lab_results,
    encounters,
    admission_medications,
    appointments,
    documents,
  };

  fs.writeFileSync(mockPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nWrote ${Object.keys(patients).length} patients to mock-data.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
