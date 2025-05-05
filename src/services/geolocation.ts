/**
 * Represents a geographical coordinate.
 */
export interface Coordinate {
  /**
   * The latitude of the coordinate.
   */
  latitude: number;
  /**
   * The longitude of the coordinate.
   */
  longitude: number;
}

/**
 * Asynchronously retrieves the current geographical coordinate.
 *
 * @returns A promise that resolves to a Coordinate object containing the latitude and longitude.
 */
export async function getCurrentCoordinate(): Promise<Coordinate> {
  // TODO: Implement this by calling an API.
  return {
    latitude: 34.0522,
    longitude: -118.2437,
  };
}
