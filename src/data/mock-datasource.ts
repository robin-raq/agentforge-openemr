import * as fs from "fs";
import * as path from "path";
import type { DataSource, PatientData, MedicationData, LabResult } from "./datasource";

interface MockData {
  patients: Record<string, PatientData>;
  medications: Record<string, MedicationData[]>;
  lab_results: Record<string, LabResult[]>;
}

export class MockDataSource implements DataSource {
  private data: MockData;

  constructor() {
    const dataPath = path.join(__dirname, "mock-data.json");
    const raw = fs.readFileSync(dataPath, "utf-8");
    this.data = JSON.parse(raw);
  }

  async getPatient(id: string): Promise<PatientData> {
    const patient = this.data.patients[id];
    if (!patient) {
      throw new Error(`Patient not found: ${id}`);
    }
    return patient;
  }

  async getMedications(patientId: string): Promise<MedicationData[]> {
    const patient = this.data.patients[patientId];
    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`);
    }
    return this.data.medications[patientId] ?? [];
  }

  async getLabResults(patientId: string): Promise<LabResult[]> {
    const patient = this.data.patients[patientId];
    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`);
    }
    return this.data.lab_results[patientId] ?? [];
  }
}
