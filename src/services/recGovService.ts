import { HttpClient } from "@/lib/httpClient";

export interface Facility {
    facilityID: number;
    facilityName: string;
    latitude: number;
    longitude: number;
    facilityDescription?: string;
    facilityTypeDescription?: string;
    facilityPhone?: string;
    facilityEmail?: string;
    facilityReservationUrl?: string;
    facilityDirections?: string;
    facilityAdaAccess?: string;
}

export interface Activity {
    activityID: number;
    activityName: string;
    activityParentID?: number;
}

export interface Availability {
    facilityID: number;
    campSiteID?: number;
    availableDate: string;
    availableStatus: 'Available' | 'Not Available' | 'Reserved';
    price?: number;
}

export interface PermitEntrance {
    permitEntranceId: number;
    permitEntranceName: string;
    permitEntranceDescription?: string;
    permitEntranceType?: string;
    facility?: Facility;
}

export interface Tour {
    tourId: number;
    tourName: string;
    tourType?: string;
    tourDuration?: number;
    tourDescription?: string;
    facility?: Facility;
}

export interface IRecGovService {
    getFacilitiesByActivity(activityId: number): Promise<Facility[]>;
    getActivities(): Promise<Activity[]>;
    searchFacilities(query: string, limit?: number): Promise<Facility[]>;
    getFacilitiesByLocation(latitude: number, longitude: number, radius?: number): Promise<Facility[]>;
    checkFacilityAvailability(facilityId: number, startDate: string, endDate: string): Promise<Availability[]>;
    checkCampsiteAvailability(campsiteId: number, startDate: string, endDate: string): Promise<Availability[]>;
    getPermitEntrances(facilityId: number): Promise<PermitEntrance[]>;
    getTours(facilityId: number): Promise<Tour[]>;
    getRecAreasByState(stateCode: string): Promise<any[]>;
}

interface RecGovApiResponse {
    RECDATA: Array<{
        FacilityID: number;
        FacilityName: string;
        FacilityLatitude: number;
        FacilityLongitude: number;
        FacilityDescription?: string;
        FacilityTypeDescription?: string;
        FacilityPhone?: string;
        FacilityEmail?: string;
        FacilityReservationURL?: string;
        FacilityDirections?: string;
        FacilityAdaAccess?: string;
    }>;
    METADATA: {
        RESULTS: {
            CURRENT_COUNT: number;
            TOTAL_COUNT: number;
        };
    };
}

export class RecGovService implements IRecGovService {
    private readonly baseUrl = "https://ridb.recreation.gov/api/v1";

    constructor(
        private readonly http: HttpClient,
        private readonly apiKey: string
    ) { }

    async getFacilitiesByActivity(activityId: number): Promise<Facility[]> {
        const url = `${this.baseUrl}/facilities?activity=${activityId}`;
        const resp = await this.http.get<RecGovApiResponse>(url, {
            headers: {
                Accept: "application/json",
                apikey: this.apiKey,
            },
        });
        return resp.RECDATA.map((f) => this.mapFacilityResponse(f));
    }

    // Get all available activities
    async getActivities(): Promise<Activity[]> {
        const url = `${this.baseUrl}/activities`;
        const resp = await this.http.get<{ RECDATA: any[] }>(url, {
            headers: {
                Accept: "application/json",
                apikey: this.apiKey,
            },
        });

        return resp.RECDATA.map(activity => ({
            activityID: activity.ActivityID,
            activityName: activity.ActivityName,
            activityParentID: activity.ActivityParentID
        }));
    }

    // Search facilities by name or keyword
    async searchFacilities(query: string, limit: number = 20): Promise<Facility[]> {
        const url = `${this.baseUrl}/facilities?query=${encodeURIComponent(query)}&limit=${limit}`;
        const resp = await this.http.get<RecGovApiResponse>(url, {
            headers: {
                Accept: "application/json",
                apikey: this.apiKey,
            },
        });

        return resp.RECDATA.map(f => this.mapFacilityResponse(f));
    }

    // Find facilities near a location
    async getFacilitiesByLocation(latitude: number, longitude: number, radius: number = 25): Promise<Facility[]> {
        const url = `${this.baseUrl}/facilities?latitude=${latitude}&longitude=${longitude}&radius=${radius}`;
        const resp = await this.http.get<RecGovApiResponse>(url, {
            headers: {
                Accept: "application/json",
                apikey: this.apiKey,
            },
        });

        return resp.RECDATA.map(f => this.mapFacilityResponse(f));
    }

    // Check availability for a facility (campground)
    async checkFacilityAvailability(facilityId: number, startDate: string, endDate: string): Promise<Availability[]> {
        // The actual Recreation.gov API doesn't have this endpoint directly
        // This might require direct access to their reservation system or a third-party service
        // For demonstration purposes, we'll simulate with a mock implementation

        // In a real implementation, you might need to:
        // 1. Get all campsites for the facility
        // 2. Check availability for each campsite

        return this.mockAvailabilityCheck(facilityId, startDate, endDate);
    }

    // Check availability for a specific campsite
    async checkCampsiteAvailability(campsiteId: number, startDate: string, endDate: string): Promise<Availability[]> {
        // Similar to above, this would require direct access to their reservation system
        // This is a mock implementation

        return [{
            facilityID: Math.floor(campsiteId / 1000), // Simulate facility ID
            campSiteID: campsiteId,
            availableDate: startDate,
            availableStatus: Math.random() > 0.5 ? 'Available' : 'Reserved',
            price: Math.floor(Math.random() * 30) + 20
        }];
    }

    // Get permit entrances for a facility
    async getPermitEntrances(facilityId: number): Promise<PermitEntrance[]> {
        const url = `${this.baseUrl}/facilities/${facilityId}/permitentrances`;
        const resp = await this.http.get<{ RECDATA: any[] }>(url, {
            headers: {
                Accept: "application/json",
                apikey: this.apiKey,
            },
        });

        return resp.RECDATA.map(entrance => ({
            permitEntranceId: entrance.PermitEntranceID,
            permitEntranceName: entrance.PermitEntranceName,
            permitEntranceDescription: entrance.PermitEntranceDescription,
            permitEntranceType: entrance.PermitEntranceType
        }));
    }

    // Get tours for a facility
    async getTours(facilityId: number): Promise<Tour[]> {
        const url = `${this.baseUrl}/facilities/${facilityId}/tours`;
        const resp = await this.http.get<{ RECDATA: any[] }>(url, {
            headers: {
                Accept: "application/json",
                apikey: this.apiKey,
            },
        });

        return resp.RECDATA.map(tour => ({
            tourId: tour.TourID,
            tourName: tour.TourName,
            tourType: tour.TourType,
            tourDuration: tour.TourDuration,
            tourDescription: tour.TourDescription
        }));
    }

    // Get recreation areas by state
    async getRecAreasByState(stateCode: string): Promise<any[]> {
        const url = `${this.baseUrl}/recareas?state=${stateCode}`;
        const resp = await this.http.get<{ RECDATA: any[] }>(url, {
            headers: {
                Accept: "application/json",
                apikey: this.apiKey,
            },
        });

        return resp.RECDATA;
    }

    // Helper method to map API response to Facility interface
    private mapFacilityResponse(f: any): Facility {
        return {
            facilityID: f.FacilityID,
            facilityName: f.FacilityName,
            latitude: f.FacilityLatitude,
            longitude: f.FacilityLongitude,
            facilityDescription: f.FacilityDescription,
            facilityTypeDescription: f.FacilityTypeDescription,
            facilityPhone: f.FacilityPhone,
            facilityEmail: f.FacilityEmail,
            facilityReservationUrl: f.FacilityReservationURL,
            facilityDirections: f.FacilityDirections,
            facilityAdaAccess: f.FacilityAdaAccess
        };
    }

    // Mock function for availability checking
    private mockAvailabilityCheck(facilityId: number, startDate: string, endDate: string): Availability[] {
        const dateStart = new Date(startDate);
        const dateEnd = new Date(endDate);
        const daysDiff = Math.ceil((dateEnd.getTime() - dateStart.getTime()) / (1000 * 3600 * 24));

        const result: Availability[] = [];

        for (let i = 0; i < daysDiff; i++) {
            const currentDate = new Date(dateStart);
            currentDate.setDate(dateStart.getDate() + i);

            // Create 3 random campsites
            for (let siteId = 1; siteId <= 3; siteId++) {
                result.push({
                    facilityID: facilityId,
                    campSiteID: facilityId * 1000 + siteId,
                    availableDate: currentDate.toISOString().split('T')[0],
                    availableStatus: Math.random() > 0.6 ? 'Available' : 'Reserved',
                    price: Math.floor(Math.random() * 30) + 20
                });
            }
        }

        return result;
    }
}