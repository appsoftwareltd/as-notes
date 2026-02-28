/**
 * A/B Testing Client Library
 *
 * Provides a simple API for running A/B tests in the application.
 * Uses consistent variant assignment based on user ID or session ID.
 *
 * @example
 * // Ensure experiment exists
 * const experiment = await AbTesting.ensureExperiment('home-page-hero', 3);
 *
 * // Get assigned variant
 * const variant = await AbTesting.getAssignedVariant('home-page-hero');
 * if (variant.variantIndex === 0) {
 *   // Show control
 * } else if (variant.variantIndex === 1) {
 *   // Show treatment 1
 * }
 *
 * // Track conversion
 * await AbTesting.trackConversion('home-page-hero', 'signup');
 * await AbTesting.trackConversion('home-page-hero', 'purchase', 49.99);
 */

interface EnsureExperimentRequest {
    experimentKey: string;
    variantCount: number;
    displayName?: string;
    description?: string;
}

interface ExperimentResponse {
    experimentKey: string;
    displayName: string;
    variantCount: number;
    isActive: boolean;
}

interface VariantResponse {
    experimentKey: string;
    variantIndex: number;
    variantName: string;
}

interface TrackConversionRequest {
    experimentKey: string;
    conversionKey: string;
    conversionValue?: number;
}

interface ConversionResponse {
    success: boolean;
    message?: string;
}

export class AbTesting {
    private static readonly BASE_URL = '/api/ab-testing';

    /**
     * Ensures an experiment exists in the database (upserts)
     * Can be called in code without checking if the test has been configured first.
     *
     * @param experimentKey - Unique identifier for the experiment (e.g., 'home-page-hero')
     * @param variantCount - Number of variants in the test (including control, minimum 2)
     * @param displayName - Optional human-readable name (defaults to experimentKey)
     * @param description - Optional description of what is being tested
     * @returns Promise resolving to the experiment details
     */
    static async ensureExperiment(
        experimentKey: string,
        variantCount: number,
        displayName?: string,
        description?: string
    ): Promise<ExperimentResponse> {
        const request: EnsureExperimentRequest = {
            experimentKey,
            variantCount,
            displayName,
            description
        };

        const response = await fetch(`${this.BASE_URL}/ensure-experiment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to ensure experiment' }));
            throw new Error(error.message || 'Failed to ensure experiment');
        }

        return await response.json();
    }

    /**
     * Gets the current test variant for the user/session
     * The user will always get the same test variant back for consistent experience.
     * Assignment is based on authenticated user ID or session ID.
     *
     * @param experimentKey - Unique identifier for the experiment
     * @returns Promise resolving to the assigned variant
     */
    static async getAssignedVariant(experimentKey: string): Promise<VariantResponse> {
        const response = await fetch(`${this.BASE_URL}/get-variant?experimentKey=${encodeURIComponent(experimentKey)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to get variant' }));
            throw new Error(error.message || 'Failed to get variant');
        }

        return await response.json();
    }

    /**
     * Reports a conversion event for the current experiment variant
     * Multiple conversions per user/session are allowed.
     *
     * @param experimentKey - Unique identifier for the experiment
     * @param conversionKey - Type of conversion (e.g., 'signup', 'purchase', 'click')
     * @param conversionValue - Optional numeric value (e.g., purchase amount)
     * @returns Promise resolving to the conversion response
     */
    static async trackConversion(
        experimentKey: string,
        conversionKey: string,
        conversionValue?: number
    ): Promise<ConversionResponse> {
        const request: TrackConversionRequest = {
            experimentKey,
            conversionKey,
            conversionValue
        };

        const response = await fetch(`${this.BASE_URL}/track-conversion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to track conversion' }));
            throw new Error(error.message || 'Failed to track conversion');
        }

        return await response.json();
    }

    /**
     * Helper method to run an experiment with automatic setup
     * Ensures the experiment exists and returns the assigned variant in one call.
     *
     * @param experimentKey - Unique identifier for the experiment
     * @param variantCount - Number of variants in the test
     * @param displayName - Optional human-readable name
     * @returns Promise resolving to the assigned variant index
     */
    static async runExperiment(
        experimentKey: string,
        variantCount: number,
        displayName?: string
    ): Promise<number> {
        await this.ensureExperiment(experimentKey, variantCount, displayName);
        const variant = await this.getAssignedVariant(experimentKey);
        return variant.variantIndex;
    }
}
